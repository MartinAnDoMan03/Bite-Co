import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyBuyerToken } from '@/middleware/buyerAuth';
import { isVoucherExpired } from "@/lib/voucherValidation";

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return withCORSHeaders(NextResponse.json({ valid: false, message: 'Authorization header required' }, { status: 401 }));
    }
    const token = authHeader.substring(7);
    let buyerData;
    try {
      buyerData = verifyBuyerToken(token);
    } catch (err) {
      return withCORSHeaders(NextResponse.json({ valid: false, message: 'Invalid or expired token' }, { status: 401 }));
    }
    const buyerId = buyerData.id;

    const { code, eventId, sellerId } = await request.json();
    if (!code || !eventId) {
      return withCORSHeaders(NextResponse.json({ valid: false, message: 'Kode dan event wajib diisi' }, { status: 400 }));
    }
    const codeUpper = code.trim().toUpperCase();

    const eventDoc = await db.collection('events').doc(eventId).get();
    if(!eventDoc.exists) {
        return withCORSHeaders(NextResponse.json({ valid: false, message: 'Event tidak ditemukan' }));
    }

    const snap = await db.collection('eventVouchers').where('code', '==', codeUpper).limit(1).get();
    if (snap.empty) {
      return withCORSHeaders(NextResponse.json({ valid: false, message: 'Kode voucher tidak ditemukan' }));
    }
    const voucherDoc = snap.docs[0];
    const voucher = voucherDoc.data();

    if (!voucher.isActive || isVoucherExpired(voucher, eventDoc.data())) {
      return withCORSHeaders(NextResponse.json({ valid: false, message: 'Voucher tidak aktif' }));
    }
    if (voucher.eventId !== eventId) {
      return withCORSHeaders(NextResponse.json({ valid: false, message: 'Voucher tidak berlaku untuk event ini' }));
    }
    if (voucher.sellerId && voucher.sellerId !== sellerId) {
      return withCORSHeaders(NextResponse.json({ valid: false, message: 'Voucher ini hanya berlaku untuk tenant tertentu' }));
    }
    if (voucher.usedCount >= voucher.quota) {
      return withCORSHeaders(NextResponse.json({ valid: false, message: 'Kuota voucher sudah habis' }));
    }

    const redemptionSnap = await db.collection('voucherRedemptions')
      .where('voucherId', '==', voucherDoc.id)
      .where('buyerId', '==', buyerId)
      .limit(1)
      .get();
    if (!redemptionSnap.empty) {
      return withCORSHeaders(NextResponse.json({ valid: false, message: 'Kamu sudah pernah menggunakan voucher ini' }));
    }

    return withCORSHeaders(NextResponse.json({
      valid: true,
      voucherId: voucherDoc.id,
      discountType: voucher.discountType,
      discountAmount: voucher.discountAmount,
      code: voucher.code,
    }));
  } catch (e) {
    console.error('[Voucher Validate Error]', e);
    return withCORSHeaders(NextResponse.json({ valid: false, message: 'Terjadi kesalahan' }, { status: 500 }));
  }
}