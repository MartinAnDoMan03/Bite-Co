import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifySellerToken } from '@/middleware/sellerAuth';

export async function OPTIONS() {
  return handleOptions();
}


// shared authcheck
async function authenticate(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Authorization header required', status: 401 };
  }
  const token = authHeader.substring(7);
  let authResult;
  try {
    authResult = await verifySellerToken(token);
  } catch (err) {
    return { error: 'Invalid or expired token', status: 401 };
  }
  if (authResult.error) {
    return { error: authResult.error, status: authResult.status || 401 };
  }
  return { sellerData: authResult.sellerData };
}

// Returns this seller's own registration details for the event — used to
// pre-fill EventMenuSelect.jsx (and could pre-fill EventRegisterForm.jsx too)
// when they come back to edit instead of starting blank.
export async function GET(request, { params }) {
  try {
    const auth = await authenticate(request);
    if (auth.error) {
      return withCORSHeaders(NextResponse.json({ error: auth.error }, { status: auth.status }));
    }
    const { eventId } = params;
    const sellerSnap = await db.collection('sellers').doc(auth.sellerData.id).get();
    const details = sellerSnap.data()?.eventDetails?.[eventId] || null;

    return withCORSHeaders(NextResponse.json({ success: true, registration: details }));
  } catch (error) {
    console.error('Error fetching seller event registration:', error);
    return withCORSHeaders(NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 }));
  }
}

export async function POST(request, { params }) {
  try {
    const auth = await authenticate(request);
    if (auth.error) {
      return withCORSHeaders(NextResponse.json({ error: auth.error }, { status: auth.status }));
    }
    const sellerData = auth.sellerData;
    const { eventId } = params;
    const body = await request.json();
    const { eventCategory, eventDescription } = body;

    const validCategories = ['makanan', 'minuman', 'snack'];
    if (!Array.isArray(eventCategory) || eventCategory.length === 0) {
      return withCORSHeaders(NextResponse.json({ error: 'Pilih minimal 1 kategori' }, { status: 400 }));
    }
    if (!eventCategory.every((c) => validCategories.includes(c))) {
      return withCORSHeaders(NextResponse.json({ error: 'Kategori tidak valid' }, { status: 400 }));
    }
    if (!eventDescription || !eventDescription.trim()) {
      return withCORSHeaders(NextResponse.json({ error: 'Deskripsi produk wajib diisi' }, { status: 400 }));
    }

    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return withCORSHeaders(NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 }));
    }

    const sellerRef = db.collection('sellers').doc(sellerData.id);
    const sellerSnap = await sellerRef.get();
    const currentEvents = sellerSnap.data()?.events || [];

    if (currentEvents.includes(eventId)) {
      return withCORSHeaders(NextResponse.json({ error: 'Kamu sudah terdaftar di event ini' }, { status: 400 }));
    }

    await sellerRef.update({
      events: [...currentEvents, eventId],
      [`eventDetails.${eventId}.eventCategory`]: eventCategory,
      [`eventDetails.${eventId}.eventDescription`]: eventDescription.trim(),
      [`eventDetails.${eventId}.status`]: 'pending',
      [`eventDetails.${eventId}.registeredAt`]: new Date().toISOString(),
    });

    await db.collection('eventRegistrations').add({
      eventId,
      sellerId: sellerData.id,
      sellerName: sellerSnap.data()?.outletName || sellerSnap.data()?.name || '-',
      eventCategory,
      eventDescription: eventDescription.trim(),
      registeredAt: new Date().toISOString(),
    });

    return withCORSHeaders(NextResponse.json({
      success: true,
      message: 'Pendaftaran berhasil!',
    }));

  } catch (error) {
    console.error('Error registering seller to event:', error);
    return withCORSHeaders(NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 }));
  }
}

// Saves which of the seller's existing menu items apply to this event.
export async function PATCH(request, { params }) {
  try {
    const auth = await authenticate(request);
    if (auth.error) {
      return withCORSHeaders(NextResponse.json({ error: auth.error }, { status: auth.status }));
    }
    const { eventId } = params;
    const { itemIds } = await request.json();
    if (!Array.isArray(itemIds)) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'itemIds harus berupa array' }, { status: 400 }));
    }

    await db.collection('sellers').doc(auth.sellerData.id).update({
      [`eventDetails.${eventId}.eventItemIds`]: itemIds,
    });

    return withCORSHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    console.error('Error saving event menu selection:', error);
    return withCORSHeaders(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
  }
}