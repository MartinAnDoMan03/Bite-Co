import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

// Public on purpose — the app checks this on launch, before login.
export async function GET() {
  try {
    const snap = await db.collection('appConfig').doc('version').get();
    const data = snap.exists ? snap.data() : {};

    // Falls back to the current shipped version if the config doc hasn't
    // been created yet, so a missing doc just means "no update nudge"
    // instead of breaking the app.
    return withCORSHeaders(NextResponse.json({
      success: true,
      latestVersion: data.latestVersion || "1.2.0",
      storeUrl: {
        ios: data.storeUrlIos || "",
        android: data.storeUrlAndroid || "",
      },
      releaseNotes: data.releaseNotes || null,
    }));
  } catch (e) {
    console.error('[App Version GET Error]', e);
    return withCORSHeaders(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
  }
}