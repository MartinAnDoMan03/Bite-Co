// POST /api/v1/admin/payouts/[sellerId]/mark-paid
// Menandai SEMUA earning pending milik 1 seller sebagai sudah dibayar

import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyAdminToken } from '@/middleware/adminAuth'; // <-- DIGANTI

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req, { params }) {
  try {
    const authResult = verifyAdminToken(req); // <-- DIGANTI
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 }));
    }

    const { sellerId } = params;
    if (!sellerId) {
      return withCORSHeaders(NextResponse.json({ error: "Missing sellerId" }, { status: 400 }));
    }

    const snapshot = await db.collection('sellerEarnings')
      .where('sellerId', '==', sellerId)
      .where('payoutStatus', '==', 'pending')
      .get();

    if (snapshot.empty) {
      return withCORSHeaders(NextResponse.json({ error: "Tidak ada earning pending untuk seller ini" }, { status: 400 }));
    }

    const payoutBatchId = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${sellerId.slice(0, 6)}`;
    const paidAt = new Date().toISOString();

    const batch = db.batch();
    let totalPaid = 0;

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        payoutStatus: 'paid',
        payoutBatchId,
        paidAt,
      });
      totalPaid += doc.data().netAmount;
    });

    await batch.commit();

    return withCORSHeaders(NextResponse.json({
      success: true,
      payoutBatchId,
      updatedCount: snapshot.size,
      totalPaid,
    }));

  } catch (error) {
    console.error('[Admin Mark Paid Error]', error);
    return withCORSHeaders(NextResponse.json({ error: error.message }, { status: 500 }));
  }
}