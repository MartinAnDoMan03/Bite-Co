import { NextResponse } from 'next/server';
import { db } from '@/firebase/configure';
import { verifyBuyerToken } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function PATCH(request) {
  try {
    const authResult = verifyBuyerToken(request);
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: 401 }));
    }

    const { buyerId } = authResult;
    if (!buyerId) {
      return withCORSHeaders(NextResponse.json({ error: "Missing buyerId" }, { status: 400 }));
    }

    const unreadSnapshot = await db.collection('notifications')
      .where('buyerId', '==', buyerId)
      .where('isRead', '==', false)
      .get();

    if (unreadSnapshot.empty) {
      return withCORSHeaders(NextResponse.json({
        success: true,
        message: 'Tidak ada notifikasi yang belum dibaca',
        updatedCount: 0
      }));
    }

    const batch = db.batch();
    const currentTime = new Date();
    unreadSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true, readAt: currentTime });
    });
    await batch.commit();

    return withCORSHeaders(NextResponse.json({
      success: true,
      message: 'Semua notifikasi berhasil ditandai sebagai sudah dibaca',
      updatedCount: unreadSnapshot.size
    }));

  } catch (error) {
    console.error('Error marking all buyer notifications as read:', error);
    return withCORSHeaders(NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server', error: error.message },
      { status: 500 }
    ));
  }
}