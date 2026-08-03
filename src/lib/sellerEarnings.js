import { db } from '@/firebase/configure';

// Ubah sesuai kebijakan komisi platform Bite&Co
const PLATFORM_FEE_PERCENT = 10;

/**
 * Membuat record sellerEarnings untuk 1 order, HANYA jika:
 * - paymentStatus === 'success' (pembayaran baru saja settle di Midtrans)
 * - belum ada record sellerEarnings untuk order ini (idempotent, anti-duplikat)
 *
 * Dipanggil dari:
 * - /api/v1/midtrans/notification/route.js (webhook), begitu transaction_status
 *   settlement/capture diterima dari Midtrans
 *
 * CATATAN KEBIJAKAN: earning dibuat begitu pembayaran sukses, BUKAN begitu
 * pesanan selesai diantar (statusProgress 'completed'). Ini keputusan bisnis
 * sengaja -- biar seller dapat modal cepat buat belanja bahan/produksi,
 * terutama buat rantangan yang mulai beberapa hari ke depan.
 *
 * @param {string} orderId
 * @param {object} orderData - data order SEBELUM update webhook (harus sudah ada sellerId, totalAmount)
 * @param {string} paymentStatus - status pembayaran baru ('success' untuk trigger)
 */
export async function createEarningIfCompleted(orderId, orderData, paymentStatus) {
  try {
    // Hanya proses kalau pembayaran baru saja sukses
    if (paymentStatus !== 'success') {
      return { created: false, reason: 'payment_not_success' };
    }

    if (!orderData.sellerId || !orderData.totalAmount) {
      console.error('[SellerEarnings] Order kurang field sellerId/totalAmount:', orderId);
      return { created: false, reason: 'missing_fields' };
    }

    // Cek idempotency: pakai orderId sebagai document ID di sellerEarnings,
    // biar kalau webhook ini kepanggil 2x (Midtrans kadang retry notif),
    // ga bikin earning dobel
    const earningRef = db.collection('sellerEarnings').doc(orderId);
    const existingEarning = await earningRef.get();

    if (existingEarning.exists) {
      console.log('[SellerEarnings] Sudah ada earning untuk order ini, skip:', orderId);
      return { created: false, reason: 'already_exists' };
    }

    const grossAmount = orderData.totalAmount;
    const platformFee = Math.round(grossAmount * (PLATFORM_FEE_PERCENT / 100));
    const netAmount = grossAmount - platformFee;

    const earningData = {
      orderId,
      sellerId: orderData.sellerId,
      sellerName: orderData.sellerName || null,
      buyerId: orderData.buyerId || null,
      buyerName: orderData.buyerName || null,
      orderType: orderData.orderType || null,
      grossAmount,
      platformFeePercent: PLATFORM_FEE_PERCENT,
      platformFee,
      netAmount,
      payoutStatus: 'pending', // pending -> paid
      payoutBatchId: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
    };

    await earningRef.set(earningData);

    console.log('[SellerEarnings] Earning dibuat untuk order:', orderId, '-> seller:', orderData.sellerId, '-> net:', netAmount);
    return { created: true, earning: earningData };

  } catch (err) {
    // Sengaja ga throw error ke atas -- kalau gagal bikin earning,
    // JANGAN sampai bikin update status pembayaran order ikut gagal juga.
    console.error('[SellerEarnings][ERROR]', orderId, err);
    return { created: false, reason: 'error', error: err.message };
  }
}