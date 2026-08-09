import { NextResponse } from 'next/server';
import { db } from '@/firebase/configure';
import { verifyBuyerToken } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function PATCH(request, { params }) {
  try {
    const authResult = verifyBuyerToken(request);
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: 401 }));
    }

    const { buyerId } = authResult;
    const { notificationId } = params;

    if (!notificationId) {
      return withCORSHeaders(NextResponse.json(
        { success: false, message: 'ID notifikasi tidak valid' },
        { status: 400 }
      ));
    }

    const notificationRef = db.collection('notifications').doc(notificationId);
    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
      return withCORSHeaders(NextResponse.json(
        { success: false, message: 'Notifikasi tidak ditemukan' },
        { status: 404 }
      ));
    }

    const notificationData = notificationDoc.data();
    if (notificationData.buyerId !== buyerId) {
      return withCORSHeaders(NextResponse.json(
        { success: false, message: 'Akses ditolak' },
        { status: 403 }
      ));
    }

    if (notificationData.isRead) {
      return withCORSHeaders(NextResponse.json({
        success: true,
        message: 'Notifikasi sudah ditandai sebagai sudah dibaca'
      }));
    }

    await notificationRef.update({ isRead: true, readAt: new Date() });

    return withCORSHeaders(NextResponse.json({
      success: true,
      message: 'Notifikasi berhasil ditandai sebagai sudah dibaca'
    }));

  } catch (error) {
    console.error('Error marking buyer notification as read:', error);
    return withCORSHeaders(NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server', error: error.message },
      { status: 500 }
    ));
  }
}