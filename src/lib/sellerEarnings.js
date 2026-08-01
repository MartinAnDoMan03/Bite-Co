import { db } from '@/firebase/configure';

// Ubah sesuai kebijakan komisi platform Bite&Co
const PLATFORM_FEE_PERCENT = 10;

/**
 * Membuat record sellerEarnings untuk 1 order, HANYA jika:
 * - order.status === 'success' (pembayaran sudah settle di Midtrans)
 * - newStatusProgress === 'completed' (pesanan sudah selesai)
 * - belum ada record sellerEarnings untuk order ini (idempotent, anti-duplikat)
 *
 * Dipanggil dari:
 * - /api/v1/seller/orders/[orderId]/complete-daily-delivery/route.js
 * - /api/v1/seller/orders/[orderId]/route.js (PATCH)
 *
 * @param {string} orderId
 * @param {object} orderData - data order SEBELUM update (harus sudah ada sellerId, totalAmount, status)
 * @param {string} newStatusProgress - status baru yang sedang di-set
 */
export async function createEarningIfCompleted(orderId, orderData, newStatusProgress) {
  try {
    // Hanya proses kalau order baru saja jadi completed
    if (newStatusProgress !== 'completed') {
      return { created: false, reason: 'not_completed' };
    }

    // Pastikan pembayaran memang sudah settle di Midtrans
    if (orderData.status !== 'success') {
      console.warn('[SellerEarnings] Order completed tapi status pembayaran bukan success:', orderId, orderData.status);
      return { created: false, reason: 'payment_not_success' };
    }

    if (!orderData.sellerId || !orderData.totalAmount) {
      console.error('[SellerEarnings] Order kurang field sellerId/totalAmount:', orderId);
      return { created: false, reason: 'missing_fields' };
    }

    // Cek idempotency: pakai orderId sebagai document ID di sellerEarnings,
    // biar kalau endpoint ini kepanggil 2x (misal race condition), ga bikin earning dobel
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
    // JANGAN sampai bikin update status order ikut gagal juga.
    console.error('[SellerEarnings][ERROR]', orderId, err);
    return { created: false, reason: 'error', error: err.message };
  }
}