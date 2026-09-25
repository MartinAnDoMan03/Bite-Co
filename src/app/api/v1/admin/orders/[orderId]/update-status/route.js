import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { releaseVoucherIfCancelled } from '@/lib/voucherRedemption';

export async function OPTIONS() {
  return handleOptions();
}

export async function PATCH(request, { params }) {
  try {
    const { orderId } = params;
    const { newStatus } = await request.json();

    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'Order tidak ditemukan' }, { status: 404 }));
    }
    const orderData = orderDoc.data();

    let updateData = { updatedAt: new Date().toISOString() };

    switch (newStatus) {
      case 'confirmed':
        updateData.status = 'success';
        updateData.statusProgress = 'awaiting_seller_approval';
        break;
      case 'awaiting_approval':
        updateData.status = 'success';
        updateData.statusProgress = 'awaiting_seller_approval';
        break;
      case 'approved':
        updateData.status = 'success';
        updateData.statusProgress = 'approved';
        updateData.approvedAt = new Date().toISOString();
        break;
      case 'rejected':
        updateData.status = 'failed';
        updateData.statusProgress = 'rejected';
        updateData.rejectedAt = new Date().toISOString();
        break;
      case 'delivered':
        updateData.status = 'success';
        updateData.statusProgress = 'completed';
        updateData.deliveredAt = new Date().toISOString();
        break;
      case 'cancelled':
        updateData.status = 'failed';
        updateData.statusProgress = 'cancelled';
        updateData.cancelledAt = new Date().toISOString();
        break;
      case 'pending':
        updateData.status = 'pending';
        updateData.statusProgress = 'pending';
        break;
      default:
        updateData.status = newStatus;
    }

    await orderRef.update(updateData);

    if (newStatus === 'rejected' || newStatus === 'cancelled') {
      await releaseVoucherIfCancelled(orderId, orderData);
    }

    return withCORSHeaders(NextResponse.json({ success: true }));
  } catch (e) {
    console.error('[Admin Order Update Status Error]', e);
    return withCORSHeaders(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
  }
}