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
      .limit(1)
      .get();

    if (snapshot.empty) {
      return withCORSHeaders(NextResponse.json({ success: true, event: null }));
    }

    const doc = snapshot.docs[0];
    const event = { id: doc.id, ...doc.data() };

    return withCORSHeaders(NextResponse.json({ success: true, event }));
  } catch (e) {
    console.error('[Events Active GET Error]', e);
    return withCORSHeaders(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
  }
}