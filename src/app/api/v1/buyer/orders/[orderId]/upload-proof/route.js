import { NextResponse } from "next/server";
import { db, storage } from "@/firebase/configure";  // ← ini baris yang di-import DARI configure.js kamu
import { verifyToken } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { notifyUser } from '@/lib/notifications';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req, { params }) {
  try {
    const authResult = verifyToken(req);
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: 401 }));
    }

    const { orderId } = params;
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return withCORSHeaders(NextResponse.json({ error: "Missing imageBase64" }, { status: 400 }));
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return withCORSHeaders(NextResponse.json({ error: "Order not found" }, { status: 404 }));
    }
    const orderData = orderSnap.data();

    if (orderData.paymentMethod !== 'manual_qris' || orderData.statusProgress !== 'approved_awaiting_payment') {
      return withCORSHeaders(NextResponse.json({ error: "Order is not awaiting manual payment" }, { status: 400 }));
    }

    const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const fileName = `payment-proofs/${orderId}-${Date.now()}.jpg`;
    const bucket = storage.bucket();
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
    const [url] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });

    await orderRef.update({
      paymentProofUrl: url,
      paymentStatus: 'pending_verification',
      paymentProofUploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return withCORSHeaders(NextResponse.json({ success: true, paymentProofUrl: url }));
  } catch (e) {
    console.error('Upload proof error:', e);
    return withCORSHeaders(NextResponse.json({ error: e.message }, { status: 500 }));
  }
}