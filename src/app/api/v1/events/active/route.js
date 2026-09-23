import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
export const dynamic = 'force-dynamic';
export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const snapshot = await db.collection('events')
      .where('isActive', '==', true)
      .get();

    if (snapshot.empty) {
      return withCORSHeaders(NextResponse.json({ success: true, event: null }));
    }

    const todayStr = new Date().toISOString().split('T')[0]; 

    const validDoc = snapshot.docs.find((doc) => {
      const data = doc.data();
      if (data.startDate && todayStr < data.startDate) return false;
      if (data.endDate && todayStr > data.endDate) return false;
      return true;
    });

    if (!validDoc) {
      return withCORSHeaders(NextResponse.json({ success: true, event: null }));
    }

    const event = { id: validDoc.id, ...validDoc.data() };

    return withCORSHeaders(NextResponse.json({ success: true, event }));
  } catch (e) {
    console.error('[Events Active GET Error]', e);
    return withCORSHeaders(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
  }
}