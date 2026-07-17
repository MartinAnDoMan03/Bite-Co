import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { createSuccessResponse, createErrorResponse } from '@/lib/auth';
import { db } from '@/firebase/configure';
import { verifyBuyerToken } from '@/middleware/buyerAuth';
import midtransClient from 'midtrans-client';

export async function POST(request, { params }) {
  const { orderId } = params;

  console.log('Payment initiation request for order:', orderId);

  if (!orderId) {
    return withCORSHeaders(createErrorResponse('Order ID is required', 400));
  }

  try {
    // Verify buyer authentication
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

    // Get the order
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

    console.log('Order payment initiation data:', {
      orderId,
      status: orderData.status,
      statusProgress: orderData.statusProgress,
      paymentStatus: orderData.paymentStatus,
      hasSnapUrl: !!orderData.snapUrl,
      buyerEmail: orderData.buyerEmail,
      totalAmount: orderData.totalAmount
    });

    // Verify this buyer owns the order
    if (orderData.buyerEmail !== buyerData.email) {
      return withCORSHeaders(createErrorResponse('You can only initiate payment for your own orders', 403));
    }

    // Check if order can accept payment
    if (orderData.statusProgress !== 'approved_awaiting_payment') {
      return withCORSHeaders(createErrorResponse('Order is not ready for payment', 400));
    }

    // If snapUrl already exists, return it
    if (orderData.snapUrl && orderData.snapToken) {
      return withCORSHeaders(createSuccessResponse({
        orderId,
        snapUrl: orderData.snapUrl,
        snapToken: orderData.snapToken,
        paymentRequired: true,
        message: 'Payment link ready'
      }));
    }

    // Generate new Midtrans payment link
    try {
      console.log('Generating new Midtrans payment link for order:', orderId);
      
      // Setup Midtrans configuration
      let serverKey = process.env.MIDTRANS_SANDBOX_SERVER_KEY;
      let isProduction = false;
      if (process.env.MIDTRANS_MODE === 'production') {
        isProduction = true;
        serverKey = process.env.MIDTRANS_PRODUCTION_SERVER_KEY;
      }

      if (!serverKey) {
        console.error('Midtrans server key not configured');
        return withCORSHeaders(createErrorResponse('Payment system not configured', 500));
      }

      const snap = new midtransClient.Snap({
        isProduction,
        serverKey
      });

      // Prepare transaction details
      const transactionDetails = {
        order_id: orderId,
        gross_amount: orderData.totalAmount || 50000, // Default amount if not set
      };

      const customerDetails = {
        first_name: orderData.buyerName || buyerData.name || 'Customer',
        email: orderData.buyerEmail || buyerData.email,
        phone: orderData.buyerPhone || '08123456789',
      };

      // Prepare items detail
      const itemDetails = orderData.items?.map((item, index) => ({
        id: `item_${index + 1}`,
        price: Math.round(item.price || 0),
        quantity: item.qty || item.quantity || 1,
        name: item.menuName || item.name || `Item ${index + 1}`,
      })) || [{
        id: 'default_item',
        price: orderData.totalAmount || 50000,
        quantity: 1,
        name: 'Food Order',
      }];

      const parameter = {
        transaction_details: transactionDetails,
        customer_details: customerDetails,
        item_details: itemDetails,
        credit_card: {
          secure: true
        },
        callbacks: {
          finish: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.biteandco.id'}/payment-success?order_id=${orderId}`,
          error: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.biteandco.id'}/payment-error?order_id=${orderId}`,
          pending: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.biteandco.id'}/payment-pending?order_id=${orderId}`,
        }
      };

      console.log('Midtrans payment parameter:', JSON.stringify(parameter, null, 2));

      // Create Snap transaction
      const transaction = await snap.createTransaction(parameter);
      
      console.log('Midtrans transaction created:', {
        token: transaction.token,
        redirect_url: transaction.redirect_url
      });

      // Update order with payment information
      await orderDoc.ref.update({
        snapToken: transaction.token,
        snapUrl: transaction.redirect_url,
        paymentStatus: 'pending',
        updatedAt: new Date().toISOString(),
      });

      return withCORSHeaders(createSuccessResponse({
        orderId,
        snapUrl: transaction.redirect_url,
        snapToken: transaction.token,
        paymentRequired: true,
        message: 'Payment link generated successfully'
      }));

    } catch (midtransError) {
      console.error('Midtrans error:', midtransError);
      return withCORSHeaders(createErrorResponse('Failed to generate payment link: ' + midtransError.message, 500));
    }

  } catch (error) {
    console.error('Error initiating payment:', error);
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error', 500));
  }
}

export async function GET(request, { params }) {
  const { orderId } = params;

  console.log('Payment status request for order:', orderId);

  if (!orderId) {
    return withCORSHeaders(createErrorResponse('Order ID is required', 400));
  }

  try {
    // Verify buyer authentication
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

    // Get the order
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

    console.log('Order payment data:', {
      orderId,
      status: orderData.status,
      statusProgress: orderData.statusProgress,
      paymentStatus: orderData.paymentStatus,
      hasSnapUrl: !!orderData.snapUrl,
      buyerEmail: orderData.buyerEmail
    });

    // Verify this buyer owns the order
    if (orderData.buyerEmail !== buyerData.email) {
      return withCORSHeaders(createErrorResponse('You can only view your own orders', 403));
    }

    // Check order status and return appropriate response
    const response = {
      orderId,
      status: orderData.status,
      statusProgress: orderData.statusProgress,
      paymentStatus: orderData.paymentStatus,
      totalAmount: orderData.totalAmount,
      orderType: orderData.orderType,
      approvedAt: orderData.approvedAt,
      rejectionReason: orderData.rejectionReason,
      paymentRequired: false // Default to false
    };

    // If order is approved and needs payment
    if (orderData.statusProgress === 'approved_awaiting_payment' && orderData.snapUrl) {
      response.paymentRequired = true;
      response.snapUrl = orderData.snapUrl;
      response.snapToken = orderData.snapToken;
      response.message = 'Order approved by seller. Please complete payment.';
    }
    // If order is rejected
    else if (orderData.statusProgress === 'cancelled' && orderData.rejectionReason) {
      response.paymentRequired = false;
      response.message = `Order rejected: ${orderData.rejectionReason}`;
    }
    // If order is still awaiting approval
    else if (orderData.statusProgress === 'awaiting_seller_approval') {
      response.paymentRequired = false;
      response.message = 'Order is awaiting seller approval.';
    }
    // If payment is not required (BiteEco)
    else if (orderData.paymentStatus === 'not_required') {
      response.paymentRequired = false;
      response.message = 'Order approved. No payment required.';
    }
    // If order is approved but no snapUrl yet
    else if (orderData.statusProgress === 'approved_awaiting_payment' && !orderData.snapUrl) {
      response.paymentRequired = false;
      response.message = 'Payment link is being generated. Please try again in a moment.';
    }
    else {
      response.paymentRequired = false;
      response.message = 'Order status updated.';
    }

    return withCORSHeaders(createSuccessResponse(response));

  } catch (error) {
    console.error('Error getting order payment status:', error);
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error', 500));
  }
}

export const OPTIONS = handleOptions;
