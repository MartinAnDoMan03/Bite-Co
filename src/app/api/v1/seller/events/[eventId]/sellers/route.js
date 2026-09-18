import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req, { params }) {
  try {
    const { eventId } = params;

    const snapshot = await db.collection('sellers')
      .where('events', 'array-contains', eventId)
      .get();

    const sellers = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.outletName || data.name || '-',
        logo: data.storeIcon || data.logo || null,
        rating: data.rating || null,
        standNumber: data.standNumber || null,
        eventCategory: data.eventCategory || null,
        eventDescription: data.eventDescription || null,
      };
    });

    return withCORSHeaders(NextResponse.json({ success: true, sellers }));
  } catch (e) {
    console.error('[Event Sellers GET Error]', e);
    return withCORSHeaders(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
  }
}