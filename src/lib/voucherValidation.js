/**
 * Satu tempat buat nentuin "voucher ini masih boleh dipakai atau nggak" --
 * dipakai baik di endpoint validasi (preview, non-consuming) maupun di
 * transaksi redemption yang sebenarnya (buyer/orders POST), biar logikanya
 * nggak pernah kepisah/beda antara dua tempat itu.
 *
 * Expired kalau salah satu dari ini kejadian:
 * 1. Event-nya lagi dimatiin manual (isActive !== true) -- ini "pause"
 *    sewaktu-waktu, terlepas dari tanggal.
 * 2. Tanggal expiry-nya udah lewat -- basisnya bisa dari tanggal event
 *    (endDate) ATAU tanggal sendiri per-voucher (buat voucher fase awal
 *    yang emang sengaja mau berhenti lebih cepat dari event-nya).
 */
export function isVoucherExpired(voucher, eventData) {
  if (!eventData || eventData.isActive !== true) return true;

  const expiryDateStr = voucher.expiryMode === 'custom' && voucher.customExpiryDate
    ? voucher.customExpiryDate
    : eventData.endDate;

  if (!expiryDateStr) return false; // kalau tidak ada info tanggal sama sekali -> jangan blokir, andalkan isActive aja

  const expiryDate = new Date(expiryDateStr);
  expiryDate.setHours(23, 59, 59, 999); // berlaku sampai akhir hari tanggal itu, bukan jam 00:00
  return new Date() > expiryDate;
}