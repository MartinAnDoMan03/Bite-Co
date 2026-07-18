import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth';
import { db } from '@/firebase/configure';
import { verifyBuyerToken } from '@/middleware/buyerAuth';

export async function OPTIONS() {
  return handleOptions();
}

// PATCH /api/buyer/orders/[orderId]/cancel
// Khusus buat buyer membatalkan order sendiri. Cuma boleh selama order
// masih 'awaiting_seller_approval' (jendela batal 15 detik / sebelum
// seller approve). Setelah seller approve, buyer TIDAK bisa cancel lewat
// endpoint ini — itu kasus lain (butuh alur refund, di luar scope ini).
export async function PATCH(request, { params }) {
  const { orderId } = params;

  if (!orderId) {
    return withCORSHeaders(createErrorResponse('Order ID is required', 400));
  }

  try {
    // Verify buyer authentication — wajib, beda dari PATCH lama yang auth-nya di-skip
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return withCORSHeaders(createErrorResponse('Authorization header required', 401));
    }

    const token = authHeader.substring(7);
    let buyerData;
    try {
      buyerData = verifyBuyerToken(token);
    } catch (err) {
      return withCORSHeaders(createErrorResponse('Invalid or expired token', 401));
    }

    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return withCORSHeaders(createErrorResponse('Order not found', 404));
    }

    const orderData = orderDoc.data();

    // Ownership check — cocokkan buyerId, bukan email (konsisten sama GET di route.js utama)
    if (orderData.buyerId !== buyerData.id) {
      return withCORSHeaders(createErrorResponse('You can only cancel your own orders', 403));
    }

    // Status transition check — cuma boleh cancel selama masih nunggu approval seller.
    // Kalau seller sudah approve (atau order sudah dalam status lain), tolak.
    if (orderData.statusProgress !== 'awaiting_seller_approval') {
      return withCORSHeaders(
        createErrorResponse(
          `Order cannot be cancelled — current status is '${orderData.statusProgress}'`,
          400
        )
      );
    }

    await orderDoc.ref.update({
      status: 'cancelled',
      statusProgress: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'buyer',
      updatedAt: new Date().toISOString(),
    });

    return withCORSHeaders(
      createSuccessResponse({ orderId, status: 'cancelled', statusProgress: 'cancelled' }, 'Order cancelled successfully')
    );
  } catch (error) {
    console.error('Error cancelling order:', error);
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error', 500));
  }
}