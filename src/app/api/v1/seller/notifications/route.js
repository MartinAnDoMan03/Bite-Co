import { NextResponse } from 'next/server';
import { db } from '@/firebase/configure';
import { createSuccessResponse, verifyToken } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

// GET /api/v1/seller/notifications
// Fetch all notifications for this seller
export async function GET(request) {
  try {
    // Verify seller token
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: 401 }));
    }

    const { sellerId } = authResult;
    
    if (!sellerId) {
      return withCORSHeaders(NextResponse.json({ error: "Missing sellerId" }, { status: 400 }));
    }

    console.log('Fetching notifications for seller:', sellerId);

    // For now, return sample notifications since we don't have real notifications yet
    const sampleNotifications = createSampleNotifications(sellerId);
    
    // Get unread count
    const unreadCount = sampleNotifications.filter(n => !n.isRead).length;

    return withCORSHeaders(NextResponse.json({
      success: true,
      data: sampleNotifications,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: sampleNotifications.length,
        hasNext: false,
        hasPrev: false
      },
      unreadCount
    }));

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return withCORSHeaders(NextResponse.json({ 
      error: 'Internal server error',
      debug: error.message 
    }, { status: 500 }));
  }
}

export async function POST(request) {
  if (request.url.includes('register-push-token')) {
    try {
      const { pushToken, userId } = await request.json();
      const userType = request.url.includes('seller') ? 'seller' : 'buyer';

      const userRef = db.collection(userType + 's').doc(userId);
      await userRef.update({ expoPushToken: pushToken });

      return withCORSHeaders(createSuccessResponse({
        message: 'Push token registered'
      }));
    } catch (error) {
      return withCORSHeaders(createErrorResponse(error.message));
    }
  }
}

// Create sample notifications for sellers
function createSampleNotifications(sellerId) {
  const currentTime = new Date();
  
  return [
    {
      id: 'sample-1',
      sellerId,
      type: 'order',
      title: 'Pesanan Baru',
      message: 'Anda mendapat pesanan baru dari pelanggan. Segera siapkan makanan terbaik!',
      isRead: false,
      createdAt: new Date(currentTime.getTime() - 5 * 60 * 1000).toISOString(),
      data: {
        orderId: 'sample-order-1',
        customerName: 'Kevin Septian'
      }
    },
    {
      id: 'sample-2',
      sellerId,
      type: 'payment',
      title: 'Pembayaran Diterima',
      message: 'Pembayaran sebesar Rp 350.000 telah diterima untuk pesanan hari ini.',
      isRead: false,
      createdAt: new Date(currentTime.getTime() - 30 * 60 * 1000).toISOString(),
      data: {
        amount: 350000,
        orderId: 'sample-order-2'
      }
    },
    {
      id: 'sample-3',
      sellerId,
      type: 'review',
      title: 'Ulasan Baru',
      message: 'Pelanggan memberikan ulasan 5 bintang untuk makanan Anda. Terima kasih!',
      isRead: true,
      createdAt: new Date(currentTime.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      data: {
        rating: 5,
        reviewId: 'sample-review-1'
      }
    },
    {
      id: 'sample-4',
      sellerId,
      type: 'system',
      title: 'Fitur Baru Tersedia',
      message: 'Sistem analisis pelanggan telah diperbarui. Cek insight pelanggan Anda!',
      isRead: true,
      createdAt: new Date(currentTime.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      data: {
        feature: 'customer-analytics'
      }
    },
    {
      id: 'sample-5',
      sellerId,
      type: 'order',
      title: 'Pesanan Akan Berakhir',
      message: 'Paket rantangan pelanggan akan berakhir besok. Siapkan penawaran renewal!',
      isRead: true,
      createdAt: new Date(currentTime.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      data: {
        orderId: 'sample-order-3'
      }
    }
  ];
}