import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth';
import { db } from '@/firebase/configure';
import { verifyToken } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

// PATCH /api/v1/seller/orders/[orderId]/location
// Dipanggil berkala oleh app seller selama order berstatus 'delivery',
// buat update posisi terkini seller supaya buyer bisa lihat live tracking.
export async function PATCH(request, { params }) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, 401));
    }
    const { sellerId } = authResult;
    const { orderId } = params;

    if (!orderId) {
      return withCORSHeaders(createErrorResponse('Missing orderId', 400));
    }

    const body = await request.json();
    const { lat, lng } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return withCORSHeaders(createErrorResponse('lat and lng (number) are required', 400));
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return withCORSHeaders(createErrorResponse('Order not found', 404));
    }

    const orderData = orderSnap.data();
    if (orderData.sellerId !== sellerId) {
      return withCORSHeaders(createErrorResponse('Unauthorized', 403));
    }

    // Cuma order yang lagi 'delivery' yang boleh update posisi — supaya tidak
    // ada sisa lokasi lama yang salah kalau seller lupa nutup halaman setelah
    // order selesai.
    if (orderData.statusProgress !== 'delivery') {
      return withCORSHeaders(createErrorResponse('Order is not currently in delivery', 400));
    }

    await orderRef.update({
      currentLat: lat,
      currentLng: lng,
      lastLocationUpdate: new Date().toISOString(),
    });

    return withCORSHeaders(createSuccessResponse({ orderId, lat, lng }, 'Location updated'));
  } catch (error) {
    console.error('Error updating delivery location:', error);
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error', 500));
  }
}