import { db } from '@/firebase/configure';
import midtransClient from 'midtrans-client';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req) {
  try {
    const body = await req.json();
    console.log('[MIDTRANS][NOTIF] Incoming payload:', JSON.stringify(body));
    let { order_id, transaction_status, fraud_status, payment_type, signature_key, gross_amount, status_code } = body;

    // Handle test payloads: strip test prefix if present
    if (order_id && order_id.startsWith('payment_notif_test_')) {
      // Midtrans test order_id format: payment_notif_test_<merchant_id>_<real_order_id>
      const parts = order_id.split('_');
      if (parts.length > 4) {
        // e.g. payment_notif_test_G038981765_08faea86-1207-4789-bc1a-e1830471b5a2
        order_id = parts.slice(4).join('_');
      } else {
        order_id = parts[parts.length - 1];
      }
      console.log('[MIDTRANS][NOTIF] Stripped test order_id:', order_id);
    }

    // Verify Midtrans Signature
    const crypto = require('crypto');
    const serverKey = process.env.MIDTRANS_PRODUCTION_SERVER_KEY || process.env.MIDTRANS_SANDBOX_SERVER_KEY;
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex');
    
    if (signature_key !== expectedSignature) {
      console.error('[MIDTRANS][NOTIF] Invalid signature for order:', order_id);
      return withCORSHeaders(new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 403 }
      ));
    }

    // Update Firestore order status
    const orderRef = db.collection('orders').doc(order_id);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      console.error('[MIDTRANS][NOTIF] Order not found for order_id:', order_id);
      // Always return 200 OK for Midtrans, but include error in body
      return withCORSHeaders(new Response(JSON.stringify({ error: 'Order not found', order_id }), { status: 200 }));
    }

    // Map Midtrans status to your app's status and statusProgress
    let newStatus = transaction_status;
    let newStatusProgress = undefined;
    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      newStatus = 'success';
      newStatusProgress = 'processing'; // Payment settled, move to processing
    } else if (transaction_status === 'cancel' || transaction_status === 'deny' || transaction_status === 'expire') {
      newStatus = 'failed';
      newStatusProgress = 'cancelled';
    } else if (transaction_status === 'pending') {
      newStatus = 'pending';
      newStatusProgress = 'waiting_approval';
    }

    const updateData = {
      status: newStatus,
      midtransStatus: transaction_status,
      fraudStatus: fraud_status,
      paymentType: payment_type,
      updatedAt: new Date().toISOString(),
    };
    if (newStatusProgress) updateData.statusProgress = newStatusProgress;

    await orderRef.update(updateData);

    console.log('[MIDTRANS][NOTIF] Order updated:', order_id, '->', newStatus, newStatusProgress);
    return withCORSHeaders(new Response(JSON.stringify({ message: 'Order status updated', status: newStatus, statusProgress: newStatusProgress, order_id }), { status: 200 }));
  } catch (err) {
    console.error('[MIDTRANS][NOTIF][ERROR]', err);
    // Always return 200 OK for Midtrans, but include error in body
    return withCORSHeaders(new Response(JSON.stringify({ error: err.message }), { status: 200 }));
  }
}
