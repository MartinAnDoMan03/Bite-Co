import { createErrorResponse, createSuccessResponse } from '@/lib/auth';
import { verifyBuyerToken } from '@/middleware/buyerAuth';
import { db } from '@/firebase/configure';
import midtransClient from 'midtrans-client';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { notifyUser } from '@/lib/notifications';

export async function OPTIONS() {
  return handleOptions();
}

function wrapCORS(response) {
  return withCORSHeaders(response);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return wrapCORS(createErrorResponse('Authorization header required', 401));
    }

    const token = authHeader.substring(7);
    let buyerData;
    try {
      buyerData = verifyBuyerToken(token);
    } catch (err) {
      return wrapCORS(createErrorResponse('Invalid or expired token', 401));
    }

    const buyerId = buyerData.id;
    console.log('[DEBUG][GET] Buyer ID:', buyerId);

    const ordersSnapshot = await db.collection('orders')
      .where('buyerId', '==', buyerId)
      .orderBy('createdAt', 'desc')
      .get();

    console.log('[FIRESTORE QUERY] buyerId ==', buyerId, 'orderBy createdAt desc');

    const orders = [];
    const nowTs = Date.now(); // Ambil waktu sekarang untuk perbandingan

    for (const doc of ordersSnapshot.docs) {
      let order = { id: doc.id, ...doc.data() };
      let isModified = false;

      // ==========================================
      // 1. LOGIKA AUTO-CANCEL (LAZY EVALUATION)
      // ==========================================
      const createdTs = new Date(order.createdAt).getTime();

      if (!isNaN(createdTs)) {
        if (order.statusProgress === 'approved_awaiting_payment') {
          const elapsedHours = (nowTs - createdTs) / (1000 * 60 * 60);
          if (elapsedHours >= 24) {
            order.statusProgress = 'cancelled';
            order.status = 'cancelled';
            order.cancelReason = 'Dibatalkan sistem: Pembayaran melewati batas waktu 24 jam';
            isModified = true;
          }
        } 

        else if (order.statusProgress === 'awaiting_seller_approval') {
          const elapsedMinutes = (nowTs - createdTs) / (1000 * 60);
          if (elapsedMinutes >= 60) {
            order.statusProgress = 'cancelled';
            order.status = 'cancelled';
            order.cancelReason = 'Dibatalkan sistem: Penjual tidak merespon dalam 1 jam';
            isModified = true;
          }
        }
      }


      if (isModified) {
        order.updatedAt = new Date().toISOString();
        db.collection("orders").doc(order.id).update({
          statusProgress: order.statusProgress,
          status: order.status,
          cancelReason: order.cancelReason,
          updatedAt: order.updatedAt
        }).catch(err => console.error("Error auto-canceling order:", err));
      }


      // ==========================================
      // 2. CEK STATUS MIDTRANS (Hanya jika belum batal)
      // ==========================================
      if (!isModified) {
        if (order.paymentMethod !== 'manual_qris' && order.snapToken) {
          try {
            let isProduction = false;
            let serverKey = process.env.MIDTRANS_SANDBOX_SERVER_KEY;
            if (process.env.MIDTRANS_MODE === 'production') {
              isProduction = true;
              serverKey = process.env.MIDTRANS_PRODUCTION_SERVER_KEY;
            }
            let snap = new midtransClient.Snap({ isProduction, serverKey });
            const status = await snap.transaction.status(order.id);
            order.paymentStatus = status.transaction_status;
          } catch (err) {
            order.paymentStatus = order.paymentStatus || 'unknown';
          }
        } else if (!order.paymentStatus) {
        order.paymentStatus = order.status || 'pending';
        }
      } else {
        order.paymentStatus = 'expire'; 
      }
      

      // ==========================================
      // 3. MAPPING STATUS PROGRESS LAMA (Legacy)
      // ==========================================
      let statusProgress = order.statusProgress;
      if (!statusProgress) {
        if (order.status === 'pending' || order.paymentStatus === 'pending') {
          statusProgress = 'waiting_approval';
        } else if (
          order.status === 'processing' ||
          order.status === 'diproses' ||
          order.paymentStatus === 'processing'
        ) {
          statusProgress = 'processing';
        } else if (
          order.status === 'delivery' ||
          order.status === 'pengiriman' ||
          order.paymentStatus === 'delivery'
        ) {
          statusProgress = 'delivery';
        } else if (
          order.status === 'completed' ||
          order.status === 'selesai' ||
          order.paymentStatus === 'settlement' ||
          order.paymentStatus === 'success' ||
          order.paymentStatus === 'completed'
        ) {
          statusProgress = 'completed';
        } else if (
          order.status === 'cancelled' ||
          order.status === 'dibatalkan' ||
          order.paymentStatus === 'cancel' ||
          order.paymentStatus === 'failed' ||
          order.paymentStatus === 'expire'
        ) {
          statusProgress = 'cancelled';
        } else {
          statusProgress = 'waiting_approval';
        }
      }
      
      order.statusProgress = statusProgress;
      orders.push(order);
    }

    return wrapCORS(createSuccessResponse({
      orders
    }, 'Orders retrieved successfully'));

  } catch (error) {
    return wrapCORS(createErrorResponse(error.message || 'Internal server error'));
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return wrapCORS(createErrorResponse('Authorization header required', 401));
    }

    const token = authHeader.substring(7);
    let buyerData;
    try {
      buyerData = verifyBuyerToken(token);
    } catch (err) {
      return wrapCORS(createErrorResponse('Invalid or expired token', 401));
    }

    const buyerId = buyerData.id;
    console.log('[DEBUG][POST] Buyer ID:', buyerId);
    
    let fullBuyerData = null;
    try {
      const buyerDoc = await db.collection('buyers').doc(buyerId).get();
      if (buyerDoc.exists) {
        fullBuyerData = buyerDoc.data();
      } else {
        return wrapCORS(createErrorResponse('Buyer not found', 404));
      }
    } catch (error) {
      console.error('Error fetching buyer data:', error);
      return wrapCORS(createErrorResponse('Error fetching buyer data', 500));
    }
    
    const orderData = await request.json();

    if (!orderData.sellerId || !orderData.items || (orderData.totalAmount === undefined || orderData.totalAmount === null)) {
      return wrapCORS(createErrorResponse('Seller ID, items, and total amount are required', 400));
    }

    if (orderData.totalAmount < 0) {
      return wrapCORS(createErrorResponse('Total amount cannot be negative', 400));
    }

    let sellerData = null;
    let sellerLat = orderData.sellerLat || null;
    let sellerLng = orderData.sellerLng || null;
    
    try {
      const sellerDoc = await db.collection('sellers').doc(orderData.sellerId).get();
      if (sellerDoc.exists) {
        sellerData = sellerDoc.data();
        if (!sellerLat) sellerLat = sellerData.pinLat || null;
        if (!sellerLng) sellerLng = sellerData.pinLng || null;
      }
    } catch (error) {
      console.error('Error fetching seller data:', error);
    }

    let distance = null;
    if (orderData.buyerLat && orderData.buyerLng && sellerLat && sellerLng) {
      distance = calculateDistance(orderData.buyerLat, orderData.buyerLng, sellerLat, sellerLng);
      console.log(`[ORDER] Distance calculated: ${distance}km between buyer(${orderData.buyerLat}, ${orderData.buyerLng}) and seller(${sellerLat}, ${sellerLng})`);
    } else {
      console.log(`[ORDER] Cannot calculate distance - buyer coords: ${orderData.buyerLat}, ${orderData.buyerLng}, seller coords: ${sellerLat}, ${sellerLng}`);
    }

    let statusProgress = 'awaiting_seller_approval';
    
    const newOrder = {
      buyerId,
      buyerName: fullBuyerData.name || '',
      buyerEmail: fullBuyerData.email || buyerData.email,
      buyerPhone: fullBuyerData.phone || '',
      sellerId: orderData.sellerId,
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      status: 'pending',
      statusProgress,
      deliveryAddress: orderData.deliveryAddress || '',
      kelurahan: orderData.kelurahan || '',
      kecamatan: orderData.kecamatan || '',
      provinsi: orderData.provinsi || '',
      kodepos: orderData.kodepos || '',
      notes: orderData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      orderType: orderData.orderType || '',
      startDate: orderData.startDate || null,
      endDate: orderData.endDate || null,
      packageType: orderData.packageType || null,
      buyerLat: orderData.buyerLat || null,
      buyerLng: orderData.buyerLng || null,
      sellerLat: sellerLat,
      sellerLng: sellerLng,
      sellerName: sellerData?.outletName || sellerData?.name || null,
      sellerAddress: sellerData?.address || null,
      sellerPinAddress: sellerData?.pinAddress || null,
      distance: distance,
    };

    const orderRef = await db.collection('orders').add(newOrder);

    await db.collection('orders').doc(orderRef.id).update({
      status: 'pending',
      statusProgress: 'awaiting_seller_approval',
      paymentStatus: 'pending'
    });

    if (orderData.orderType === 'Bite Eco' || orderData.totalAmount === 0) {
      await db.collection('orders').doc(orderRef.id).update({
        paymentMethod: 'Free - Bite Eco',
        paymentStatus: 'not_required'
      });
    }

    await notifyUser({
      userType: 'seller',
      userId: orderData.sellerId,
      type: 'order',
      title: 'Pesanan Baru!',
      message: `Pesanan baru dari ${fullBuyerData.name || 'Buyer'} menunggu persetujuan Anda.`,
      data: { orderId: orderRef.id, buyerId, status: 'awaiting_seller_approval' },
    });

    return wrapCORS(createSuccessResponse({
      orderId: orderRef.id,
      message: 'Order created successfully. Waiting for seller approval.',
      order: {
        id: orderRef.id,
        ...newOrder,
        status: 'pending',
        statusProgress: 'awaiting_seller_approval',
        paymentStatus: orderData.orderType === 'Bite Eco' || orderData.totalAmount === 0 ? 'not_required' : 'pending'
      }
    }, 'Order created successfully'))

  } catch (error) {
    console.error('Error creating order:', error);
    return wrapCORS(createErrorResponse(error.message || 'Internal server error'));
  }
}