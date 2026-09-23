import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req, { params }) {
  try {
    const { eventId } = params;
    const snapshot = await db.collection('eventVouchers').where('eventId', '==', eventId).get();
    const vouchers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return withCORSHeaders(NextResponse.json({ success: true, vouchers }));
  } catch (e) {
    console.error('[Event Vouchers GET Error]', e);
    return withCORSHeaders(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
  }
}

export async function POST(req, { params }) {
  try {
    const { eventId } = params;
    const { code, sellerId, discountAmount, quota, expiryMode, customExpiryDate } = await req.json();

    if(expiryMode === 'custom' && !customExpiryDate) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'Tanggal expired wajib diisi jika menggunakan tanggal sendiri' }, { status: 400 }));
    }

    if (!code || !code.trim()) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'Kode voucher wajib diisi' }, { status: 400 }));
    }
    const codeUpper = code.trim().toUpperCase();
    if (!discountAmount || discountAmount <= 0 || discountAmount > 100) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'Diskon harus antara 1-100%' }, { status: 400 }));
    }
    if (!quota || quota <= 0) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'Kuota harus lebih dari 0' }, { status: 400 }));
    }

    // Kode voucher unik secara global (bukan per-event), supaya lookup di sisi
    // buyer tetap simpel — cukup query by code tanpa perlu tahu eventId dulu.
    const existing = await db.collection('eventVouchers').where('code', '==', codeUpper).limit(1).get();
    if (!existing.empty) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'Kode voucher sudah dipakai, coba kode lain' }, { status: 400 }));
    }

    const voucherRef = await db.collection('eventVouchers').add({
      eventId,
      sellerId: sellerId || null,
      code: codeUpper,
      discountType: 'percentage',
      discountAmount: Number(discountAmount),
      quota: Number(quota),
      usedCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      expiryMode: expiryMode === 'custom' ? 'custom' : 'event',
      customExpiryDate: expiryMode === 'custom' ? customExpiryDate : null,
    });

    return withCORSHeaders(NextResponse.json({ success: true, voucherId: voucherRef.id }));
  } catch (e) {
    console.error('[Event Vouchers POST Error]', e);
    return withCORSHeaders(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
  }
}

export async function PATCH(req, { params }) {
  try {
    const { voucherId, isActive } = await req.json();
    if (!voucherId) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'voucherId wajib diisi' }, { status: 400 }));
    }
    await db.collection('eventVouchers').doc(voucherId).update({ isActive: !!isActive });
    return withCORSHeaders(NextResponse.json({ success: true }));
  } catch (e) {
    console.error('[Event Vouchers PATCH Error]', e);
    return withCORSHeaders(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
  }
}