import { db, storage } from '@/firebase/configure';
import { NextResponse } from 'next/server';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request, { params }) {
  try {
    const { eventId } = params;
    const doc = await db.collection('events').doc(eventId).get();

    if (!doc.exists) {
      return withCORSHeaders(
        NextResponse.json({ success: false, message: 'Event tidak ditemukan' }, { status: 404 })
      );
    }

    const data = doc.data();

    return withCORSHeaders(NextResponse.json({
      success: true,
      event: {
        id: doc.id,
        name: data.name || '-',
        shortName: data.shortName || data.name || '-',
        location: data.location || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        isActive: data.isActive || false,
        sellerBannerImageUrl: data.sellerBannerImageUrl || null,
        termsAndConditions: data.termsAndConditions || '',
      },
    }));
  } catch (error) {
    console.error('Error fetching event:', error);
    return withCORSHeaders(
      NextResponse.json({ success: false, message: error.message }, { status: 500 })
    );
  }
}

// PUT: Update event via admin only
export async function PUT(request, { params }) {
  try {
    verifyAdmin(request);

    const { eventId } = params;
    const body = await request.json();

    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'Event not found' }, { status: 404 }));
    }

    const updateData = { ...body, updatedAt: new Date().toISOString() };
    delete updateData.id;
    delete updateData.createdAt;

    await eventRef.update(updateData);

    return withCORSHeaders(NextResponse.json({ success: true, message: 'Event updated successfully' }));
  } catch (error) {
    console.error('Error updating event:', error);
    return withCORSHeaders(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
  }
}

// DELETE: Delete event via admin only
export async function DELETE(request, { params }) {
  try {
    verifyAdmin(request);

    const { eventId } = params;
    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'Event not found' }, { status: 404 }));
    }

    await eventRef.delete();

    return withCORSHeaders(NextResponse.json({ success: true, message: 'Event deleted successfully' }));
  } catch (error) {
    console.error('Error deleting event:', error);
    return withCORSHeaders(NextResponse.json({ success: false, message: error.message }, { status: 500 }));
  }
}