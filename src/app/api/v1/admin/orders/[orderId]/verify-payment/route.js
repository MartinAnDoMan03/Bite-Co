import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyAdminToken } from '@/middleware/adminAuth';
import { notifyUser } from '@/lib/notifications';
import { createEarningIfCompleted } from '@/lib/sellerEarnings';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req, { params }) {
  try {
    const authResult = verifyAdminToken(req);
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 }));
    }

    const { orderId } = params;
    const { action } = await req.json(); // 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return withCORSHeaders(NextResponse.json({ error: "Invalid action" }, { status: 400 }));
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return withCORSHeaders(NextResponse.json({ error: "Order not found" }, { status: 404 }));
    }
    const orderData = orderSnap.data();

    if (orderData.paymentStatus !== 'pending_verification') {
      return withCORSHeaders(NextResponse.json({ error: `Order payment status is ${orderData.paymentStatus}, not pending_verification` }, { status: 400 }));
    }

    if (action === 'approve') {
      await orderRef.update({
        paymentStatus: 'verified',
        status: 'success', // samain sama field yang dipakai createEarningIfCompleted
        statusProgress: 'processing',
        paymentVerifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      // Trigger pembuatan earning di sini, karena manual QRIS ga punya webhook
      // Midtrans yang biasanya melakukan ini. orderData yang dioper harus
      // sudah punya sellerId & totalAmount (sudah ada dari order asli).
      await createEarningIfCompleted(orderId, orderData, 'success');
      await notifyUser({
        userType: 'buyer',
        userId: orderData.buyerId,
        type: 'order',
        title: 'Pembayaran Terverifikasi',
        message: 'Pembayaran kamu sudah dikonfirmasi. Pesanan sedang diproses penjual.',
        data: { orderId, status: 'processing' },
      });
    } else {
      await orderRef.update({
        paymentStatus: 'rejected',
        paymentVerifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await notifyUser({
        userType: 'buyer',
        userId: orderData.buyerId,
        type: 'order',
        title: 'Bukti Pembayaran Ditolak',
        message: 'Bukti pembayaran tidak valid. Silakan upload ulang bukti transfer yang jelas.',
        data: { orderId, status: 'rejected' },
      });
    }

    return withCORSHeaders(NextResponse.json({ success: true, action }));
  } catch (e) {
    return withCORSHeaders(NextResponse.json({ error: e.message }, { status: 500 }));
  }
}