// GET /api/v1/seller/orders/[orderId]/complete-daily-delivery
import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { verifyToken } from '@/lib/auth';
import { withCORSHeaders } from '@/lib/cors';
import { createEarningIfCompleted } from '@/lib/sellerEarnings'; // <-- BARU

/**
 * POST /api/v1/seller/orders/[orderId]/complete-daily-delivery
 * Complete today's delivery for a recurring Rantangan order
 */
export async function POST(req, { params }) {
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
    const { deliveryDate, deliveryTime } = body;

    if (!deliveryDate) {
      return withCORSHeaders(NextResponse.json({ error: "Missing deliveryDate" }, { status: 400 }));
    }

    // Get order document
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      return withCORSHeaders(NextResponse.json({ error: "Order not found" }, { status: 404 }));
    }

    const orderData = orderSnap.data();
    
    if (orderData.sellerId !== sellerId) {
      return withCORSHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 403 }));
    }

    // Verify this is a recurring Rantangan order
    const isRantanganRecurring = (orderData.orderType === 'Rantangan' || orderData.orderType?.includes('Rantangan')) &&
                                (orderData.packageType === 'Mingguan' || orderData.packageType === 'Bulanan');
    
    if (!isRantanganRecurring) {
      return withCORSHeaders(NextResponse.json({ error: "This endpoint is only for recurring Rantangan orders" }, { status: 400 }));
    }

    // Create daily delivery log entry
    const deliveryLog = {
      deliveryDate: deliveryDate,
      deliveryTime: deliveryTime || new Date().toISOString(),
      completedTime: new Date().toISOString()
    };

    // Get existing daily delivery logs
    const existingLogs = orderData.dailyDeliveryLogs || [];
    
    // Check if delivery for this date already exists
    const existingLogIndex = existingLogs.findIndex(log => log.deliveryDate === deliveryDate);
    
    if (existingLogIndex !== -1) {
      // Update existing log
      existingLogs[existingLogIndex] = deliveryLog;
    } else {
      // Add new log
      existingLogs.push(deliveryLog);
    }

    // Calculate if all deliveries are completed
    const startDate = new Date(orderData.startDate);
    const endDate = new Date(orderData.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const completedDays = existingLogs.length;

    // Determine next status
    let newStatus;
    if (completedDays >= totalDays) {
      // All deliveries completed - final completion
      newStatus = 'completed';
    } else {
      // More days remaining - cycle back to processing
      newStatus = 'processing';
    }

    // Update order with new delivery log and status
    const updateData = {
      dailyDeliveryLogs: existingLogs,
      statusProgress: newStatus,
      updatedAt: new Date().toISOString()
    };

    await orderRef.update(updateData);

    // === BARU: generate seller earning kalau baru saja completed ===
    await createEarningIfCompleted(orderId, orderData, newStatus);
    // orderData dipakai (bukan hasil get ulang) karena field yg dibutuhin
    // (sellerId, totalAmount, status) ga berubah oleh update ini

    // Calculate days remaining
    const today = new Date();
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    return withCORSHeaders(NextResponse.json({
      success: true,
      newStatus,
      dailyDeliveryLogs: existingLogs,
      deliveryLog,
      summary: {
        totalDays,
        completedDays,
        daysRemaining,
        isFullyCompleted: newStatus === 'completed'
      }
    }));

  } catch (error) {
    console.error('[Complete Daily Delivery Error]', error);
    return withCORSHeaders(NextResponse.json({ error: error.message }, { status: 500 }));
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return withCORSHeaders(new Response(null, { status: 200 }));
}