import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifySellerToken } from '@/middleware/sellerAuth';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return withCORSHeaders(NextResponse.json({ error: 'Authorization header required' }, { status: 401 }));
    }

    const token = authHeader.substring(7);
    let authResult;
    try {
      authResult = await verifySellerToken(token);
    } catch (err) {
      return withCORSHeaders(NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }));
    }
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 }));
    }

    const sellerData = authResult.sellerData;
    const { eventId } = params;
    const body = await request.json();
    const { eventCategory, eventDescription } = body;

    if (!eventCategory || !['makanan', 'minuman', 'snack'].includes(eventCategory)) {
      return withCORSHeaders(NextResponse.json({ error: 'Kategori tidak valid' }, { status: 400 }));
    }
    if (!eventDescription || !eventDescription.trim()) {
      return withCORSHeaders(NextResponse.json({ error: 'Deskripsi produk wajib diisi' }, { status: 400 }));
    }

    // Cek event-nya beneran ada & aktif
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

    // Update dokumen seller: tambah eventId ke array events, set kategori & deskripsi
    await sellerRef.update({
      events: [...currentEvents, eventId],
      eventCategory,
      eventDescription: eventDescription.trim(),
      standNumber: null, // diisi admin manual belakangan
    });

    // Simpan juga sebagai catatan pendaftaran terpisah, buat riwayat/audit
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
      message: 'Pendaftaran berhasil! Kamu akan tampil di listing event setelah admin melengkapi nomor stand.',
    }));

  } catch (error) {
    console.error('Error registering seller to event:', error);
    return withCORSHeaders(NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 }));
  }
}