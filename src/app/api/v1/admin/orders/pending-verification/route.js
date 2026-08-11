import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
// TODO: sesuaikan sama middleware admin auth yang kamu pakai di route admin lain
import { verifyAdminToken } from '@/middleware/adminAuth';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req) {
  try {
    const authResult = verifyAdminToken(req);
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 }));
    }

    const snapshot = await db.collection("orders")
      .where("paymentStatus", "==", "pending_verification")
      .orderBy("paymentProofUploadedAt", "desc")
      .get();

    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return withCORSHeaders(NextResponse.json({ orders }));
  } catch (e) {
    return withCORSHeaders(NextResponse.json({ error: e.message }, { status: 500 }));
  }
}