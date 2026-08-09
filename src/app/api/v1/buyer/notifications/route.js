import { NextResponse } from 'next/server';
import { db } from '@/firebase/configure';
import { verifyBuyerToken } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

// GET /api/v1/buyer/notifications
export async function GET(request) {
  try {
    const authResult = verifyBuyerToken(request);
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: 401 }));
    }

    const { buyerId } = authResult;
    if (!buyerId) {
      return withCORSHeaders(NextResponse.json({ error: "Missing buyerId" }, { status: 400 }));
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const isRead = url.searchParams.get('isRead');
    const type = url.searchParams.get('type');

    let query = db.collection('notifications')
      .where('buyerId', '==', buyerId)
      .orderBy('createdAt', 'desc');

    if (isRead !== null && isRead !== undefined) {
      query = query.where('isRead', '==', isRead === 'true');
    }
    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();
    const notifications = [];
    snapshot.forEach(doc => notifications.push({ id: doc.id, ...doc.data() }));

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedNotifications = notifications.slice(startIndex, endIndex);
    const unreadCount = notifications.filter(n => !n.isRead).length;

    return withCORSHeaders(NextResponse.json({
      success: true,
      data: paginatedNotifications,
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(notifications.length / limit)),
        totalCount: notifications.length,
        hasNext: endIndex < notifications.length,
        hasPrev: page > 1
      },
      unreadCount
    }));

  } catch (error) {
    console.error('Error fetching buyer notifications:', error);
    return withCORSHeaders(NextResponse.json({
      error: 'Internal server error',
      debug: error.message
    }, { status: 500 }));
  }
}