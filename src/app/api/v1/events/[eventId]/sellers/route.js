import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { notifyUser } from '@/lib/notifications';
export const dynamic = 'force-dynamic';
export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req, { params }) {
  try {
    const { eventId } = params;
    const { searchParams } = new URL(req.url);
    const includeAll = searchParams.get('includeAll') === 'true';

    const snapshot = await db.collection('sellers')
      .where('events', 'array-contains', eventId)
      .get();

    const sellers = snapshot.docs.map(doc => {
      const data = doc.data();
      const details = data.eventDetails?.[eventId] || {};
      return {
        id: doc.id,
        name: data.outletName || data.name || '-',
        logo: data.storeIcon || data.logo || null,
        rating: data.rating || null,
        eventCategory: details.eventCategory || null,
        eventDescription: details.eventDescription || null,
        status: details.status || 'pending',
        registeredAt: details.registeredAt || null,
      };
    })
    //for buyers only see approved sellers
    .filter(s => includeAll || s.status === 'approved');

    return withCORSHeaders(NextResponse.json({ success: true, sellers }));
  } catch (e) {
    console.error('[Event Sellers GET Error]', e);
    return withCORSHeaders(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
  }
}

export async function PATCH(req, { params }) {
  try {
    const { eventId } = params;
    const { sellerId, status } = await req.json();

    if (!sellerId) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'sellerId wajib diisi' }, { status: 400 }));
    }
    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      return withCORSHeaders(NextResponse.json({ success: false, message: 'Status tidak valid' }, { status: 400 }));
    }

    await db.collection('sellers').doc(sellerId).update({
      [`eventDetails.${eventId}.status`]: status,
    });

    if (status === 'approved' || status === 'rejected') {
      const eventDoc = await db.collection('events').doc(eventId).get();
      const eventName = eventDoc.exists ? (eventDoc.data().name || eventDoc.data().shortName || 'event ini') : 'event ini';

      await notifyUser({
        userType: 'seller',
        userId: sellerId,
        type: 'event',
        title: status === 'approved' ? 'Pendaftaran Event Disetujui' : 'Pendaftaran Event Ditolak',
        message: status === 'approved'
          ? `Pendaftaran kamu untuk "${eventName}" sudah disetujui. Yuk atur menu buat event ini.`
          : `Pendaftaran kamu untuk "${eventName}" ditolak. Hubungi admin kalau ada pertanyaan.`,
        data: { eventId, status, recipientRole: 'seller' },
      });
    }

    return withCORSHeaders(NextResponse.json({ success: true }));
  } catch (e) {
    console.error('[Event Sellers PATCH Error]', e);
    return withCORSHeaders(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
  }
}