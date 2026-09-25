import { db } from '@/firebase/configure';

/**
 * Mengembalikan kuota voucher + hapus record redemption-nya, kalau order yang
 * batal/ditolak sebelumnya sempet makai voucher. Tanpa ini, voucher yang
 * dipakai buat order yang gak jadi (dibatalin sebelum bayar, atau ditolak
 * seller) bakal kepotong permanen dari kuota DAN buyer-nya kehilangan
 * jatah sekali-pakainya, padahal transaksinya sendiri gak pernah kejadian.
 *
 * Idempotent: aman dipanggil lebih dari sekali buat order yang sama --
 * ceknya lewat field `voucherReleased` di order-nya sendiri.
 *
 * @param {string} orderId
 * @param {object} orderData 
 */
export async function releaseVoucherIfCancelled(orderId, orderData) {
  try {
    if (!orderData.voucherId) {
      return { released: false, reason: 'no_voucher' };
    }
    if (orderData.voucherReleased) {
      return { released: false, reason: 'already_released' };
    }

    const voucherRef = db.collection('eventVouchers').doc(orderData.voucherId);

    await db.runTransaction(async (tx) => {
      const voucherDoc = await tx.get(voucherRef);
      if (!voucherDoc.exists) return; // voucher-nya udah kehapus, skip aja

      const redemptionSnap = await tx.get(
        db.collection('voucherRedemptions')
          .where('voucherId', '==', orderData.voucherId)
          .where('buyerId', '==', orderData.buyerId)
          .limit(1)
      );

      const currentUsed = voucherDoc.data().usedCount || 0;
      tx.update(voucherRef, { usedCount: Math.max(0, currentUsed - 1) });

      if (!redemptionSnap.empty) {
        tx.delete(redemptionSnap.docs[0].ref);
      }

      tx.update(db.collection('orders').doc(orderId), { voucherReleased: true });
    });

    console.log('[VoucherRedemption] Kuota dikembalikan buat order:', orderId, '-> voucher:', orderData.voucherId);
    return { released: true };
  } catch (err) {

    console.error('[VoucherRedemption][ERROR]', orderId, err);
    return { released: false, reason: 'error', error: err.message };
  }
}