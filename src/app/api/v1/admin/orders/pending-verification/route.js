import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
// TODO: sesuaikan sama middleware admin auth yang kamu pakai di route admin lain
import { verifyAdminToken } from '@/middleware/adminAuth';

export async function OPTIONS() {
  return handleOptions();
}

// Tab di halaman admin ('pending' | 'approved' | 'rejected') di-mapping ke
// nilai paymentStatus yang sebenarnya dipakai di collection 'orders', karena
// nama tab di UI beda sama nama value di database.
const STATUS_MAP = {
  pending: 'pending_verification',
  approved: 'verified',
  rejected: 'rejected',
};

export async function GET(req) {
  try {
    const authResult = verifyAdminToken(req);
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 }));
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('status');
    const paymentStatus = STATUS_MAP[tab] || STATUS_MAP.pending;

    // Order yang masih menunggu diurutkan dari yang paling lama upload bukti
    // (biar ke-antri fair), sedangkan yang sudah diverifikasi/ditolak
    // diurutkan dari yang paling baru diproses admin.
    const dateField = paymentStatus === 'pending_verification'
      ? 'paymentProofUploadedAt'
      : 'paymentVerifiedAt';

    const snapshot = await db.collection("orders")
      .where("paymentStatus", "==", paymentStatus)
      .orderBy(dateField, "desc")
      .get();

    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return withCORSHeaders(NextResponse.json({ orders }));
  } catch (e) {
    console.error('[Admin Pending Verification GET Error]', e);
    return withCORSHeaders(NextResponse.json({ error: e.message }, { status: 500 }));
  }
}