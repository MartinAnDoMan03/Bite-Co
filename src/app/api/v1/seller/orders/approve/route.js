import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth';
import { db } from '@/firebase/configure';
import { verifySellerToken } from '@/middleware/sellerAuth';
import midtransClient from 'midtrans-client';
import { notifyUser } from '@/lib/notifications';

// Toggle sementara selama proses review bisnis Midtrans berjalan.
// 'midtrans' = flow asli (Snap API). 'manual_qris' = QRIS statis + verifikasi manual admin.
// Ganti balik ke 'midtrans' di .env begitu akun disetujui — kode Midtrans di bawah TIDAK dihapus.
const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'midtrans';

export async function POST(request) {
  const reqData = await request.json();
  const { orderId, action, rejectionReason } = reqData;

  console.log('Seller approve/reject request:', { orderId, action, rejectionReason });

  if (!orderId || !action) {
    return withCORSHeaders(createErrorResponse('Order ID and action are required', 400));
  }

  if (!['approve', 'reject'].includes(action)) {
    return withCORSHeaders(createErrorResponse('Action must be approve or reject', 400));
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return withCORSHeaders(createErrorResponse('Authorization header required', 401));
    }

    const token = authHeader.substring(7);
    let authResult;
    try {
      authResult = await verifySellerToken(token);
    } catch (err) {
      return withCORSHeaders(createErrorResponse('Invalid or expired token', 401));
    }

    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status));
    }

    const sellerData = authResult.sellerData;

    let orderDoc;
    try {
      orderDoc = await db.collection('orders').doc(orderId).get();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return withCORSHeaders(createErrorResponse('Database connection failed', 500));
    }
    
    if (!orderDoc.exists) {
      return withCORSHeaders(createErrorResponse('Order not found', 404));
    }

    const orderData = orderDoc.data();

    console.log('Order data:', { 
      orderId, 
      currentStatus: orderData.statusProgress, 
      sellerId: orderData.sellerId,
      requestedAction: action 
    });

    if (orderData.sellerId !== sellerData.id) {
      return withCORSHeaders(createErrorResponse('You can only manage your own orders', 403));
    }

    if (action === 'approve' && !['awaiting_seller_approval', 'waiting_approval'].includes(orderData.statusProgress)) {
      return withCORSHeaders(createErrorResponse(`Order is not awaiting seller approval. Current status: ${orderData.statusProgress}`, 400));
    }

    if (action === 'reject' && !['awaiting_seller_approval', 'waiting_approval', 'approved_awaiting_payment', 'pending'].includes(orderData.statusProgress)) {
      return withCORSHeaders(createErrorResponse(`Order cannot be rejected in current status: ${orderData.statusProgress}`, 400));
    }

    if (action === 'reject') {
      await db.collection('orders').doc(orderId).update({
        status: 'cancelled',
        statusProgress: 'cancelled',
        rejectionReason: rejectionReason || 'Rejected by seller',
        updatedAt: new Date().toISOString()
      });
      
      await notifyUser({
        userType: 'buyer',
        userId: orderData.buyerId,
        type: 'order',
        title: 'Pesanan Ditolak',
        message: rejectionReason || 'Pesanan Anda ditolak oleh penjual.',
        data: { orderId, status: 'cancelled' },
      });

      return withCORSHeaders(createSuccessResponse({
        orderId,
        message: 'Order rejected successfully'
      }));
    }

    if (action === 'approve') {
      if (orderData.orderType === 'Bite Eco' || orderData.totalAmount === 0 || orderData.paymentStatus === 'not_required') {
        await db.collection('orders').doc(orderId).update({
          status: 'processing',
          statusProgress: 'processing',
          paymentStatus: 'not_required',
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await notifyUser({
          userType: 'buyer',
          userId: orderData.buyerId,
          type: 'order',
          title: 'Pesanan Disetujui',
          message: 'Pesanan Bite Eco Anda telah disetujui dan sedang diproses.',
          data: { orderId, status: 'processing' },
        });

        return withCORSHeaders(createSuccessResponse({
          orderId,
          message: 'BiteEco order approved successfully',
          paymentRequired: false
        }));
      }

      // ==== CABANG BARU: manual QRIS (sementara, sambil nunggu Midtrans) ====
      if (PAYMENT_PROVIDER === 'manual_qris') {
        await db.collection('orders').doc(orderId).update({
          statusProgress: 'approved_awaiting_payment',
          paymentMethod: 'manual_qris',
          paymentStatus: 'pending_payment',
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await notifyUser({
          userType: 'buyer',
          userId: orderData.buyerId,
          type: 'order',
          title: 'Pesanan Disetujui',
          message: 'Pesanan Anda telah disetujui. Silakan lakukan pembayaran via QRIS.',
          data: { orderId, status: 'approved_awaiting_payment' },
        });

        return withCORSHeaders(createSuccessResponse({
          orderId,
          message: 'Order approved successfully. Manual QRIS payment required.',
          paymentRequired: true,
          paymentMethod: 'manual_qris'
        }));
      }
      // ==== akhir cabang baru ====

      let isProduction = false;
      let serverKey = process.env.MIDTRANS_SANDBOX_SERVER_KEY;
      if (process.env.MIDTRANS_MODE === 'production') {
        isProduction = true;
        serverKey = process.env.MIDTRANS_PRODUCTION_SERVER_KEY;
      }
      const snap = new midtransClient.Snap({
        isProduction,
        serverKey,
      });

      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: orderData.totalAmount,
        },
        credit_card: {
          secure: true,
        },
        customer_details: {
          first_name: orderData.buyerName,
          email: orderData.buyerEmail,
          phone: orderData.buyerPhone,
        },
      };

      let snapResponse;
      try {
        snapResponse = await snap.createTransaction(parameter);
      } catch (err) {
        console.error('Midtrans error:', err);
        return withCORSHeaders(createErrorResponse('Failed to create payment link: ' + err.message, 500));
      }

      await db.collection('orders').doc(orderId).update({
        statusProgress: 'approved_awaiting_payment',
        snapUrl: snapResponse.redirect_url,
        snapToken: snapResponse.token,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await notifyUser({
        userType: 'buyer',
        userId: orderData.buyerId,
        type: 'order',
        title: 'Pesanan Disetujui',
        message: 'Pesanan Anda telah disetujui. Silakan selesaikan pembayaran.',
        data: { orderId, snapUrl: snapResponse.redirect_url, status: 'approved_awaiting_payment' },
      });

      return withCORSHeaders(createSuccessResponse({
        orderId,
        message: 'Order approved successfully. Payment link generated.',
        paymentRequired: true,
        snapUrl: snapResponse.redirect_url,
        snapToken: snapResponse.token
      }));
    }

  } catch (error) {
    console.error('Error processing seller action:', error);
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error', 500));
  }
}

export const OPTIONS = handleOptions;