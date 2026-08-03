// GET /api/v1/seller/orders/[orderId]
import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
// PATCH /api/v1/seller/orders/[orderId]
import { verifyToken } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { createEarningIfCompleted } from '@/lib/sellerEarnings'; 

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req, { params }) {
  const { orderId } = params;
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }
  try {
    console.log('[DEBUG][Order Detail] orderId:', orderId);
    const doc = await db.collection("orders").doc(orderId).get();
    console.log('[DEBUG][Order Detail] doc.exists:', doc.exists);
    if (!doc.exists) {
      return withCORSHeaders(NextResponse.json({ error: "Order not found", debug: { orderId, exists: doc.exists } }, { status: 404 }));
    }
    const order = { id: doc.id, ...doc.data() };
    return withCORSHeaders(NextResponse.json({ order }));
  } catch (e) {
    return withCORSHeaders(NextResponse.json({ error: e.message }, { status: 500 }));
  }
}

export async function PATCH(req, { params }) {
  try {
    const authResult = verifyToken(req);
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: 401 }));
    }
    const { sellerId } = authResult;
    const { orderId } = params;
    if (!orderId) {
      return withCORSHeaders(NextResponse.json({ error: "Missing orderId" }, { status: 400 }));
    }
    const body = await req.json();
    const { statusProgress, dailyDeliveryLogs } = body;
    
    if (!statusProgress) {
      return withCORSHeaders(NextResponse.json({ error: "Missing statusProgress" }, { status: 400 }));
    }
    
    // Get order doc
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return withCORSHeaders(NextResponse.json({ error: "Order not found" }, { status: 404 }));
    }
    const orderData = orderSnap.data();
    if (orderData.sellerId !== sellerId) {
      return withCORSHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }));
    }
    
    // Prepare update data
    const updateData = {
      statusProgress,
      updatedAt: new Date().toISOString()
    };

    const now = new Date().toISOString();
    if (statusProgress === 'processing') updateData.processingAt = now;
    if (statusProgress === 'delivery') updateData.deliveryAt = now;
    if (statusProgress === 'completed') updateData.completedAt = now;
    
    // Add daily delivery logs if provided
    if (dailyDeliveryLogs !== undefined) {
      updateData.dailyDeliveryLogs = dailyDeliveryLogs;
    }
    
    await orderRef.update(updateData);

    // === BARU: generate seller earning kalau baru saja completed ===
    await createEarningIfCompleted(orderId, orderData, statusProgress);
    // orderData di sini adalah data SEBELUM patch (masih punya status pembayaran asli),
    // yang memang yang kita butuhin buat validasi status === 'success'

    return withCORSHeaders(NextResponse.json({ 
      success: true, 
      statusProgress,
      dailyDeliveryLogs: updateData.dailyDeliveryLogs || orderData.dailyDeliveryLogs || []
    }));
  } catch (e) {
    return withCORSHeaders(NextResponse.json({ error: e.message }, { status: 500 }));
  }
}