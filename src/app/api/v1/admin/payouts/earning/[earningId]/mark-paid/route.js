// POST /api/v1/admin/payouts/earning/[earningId]/mark-paid
// Menandai SATU earning (1 order) sebagai sudah dibayar — bukan seluruh earning seller

import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyAdminToken } from '@/middleware/adminAuth';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req, { params }) {
  try {
    const authResult = verifyAdminToken(req);
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 }));
    }

    const { earningId } = params;
    if (!earningId) {
      return withCORSHeaders(NextResponse.json({ error: "Missing earningId" }, { status: 400 }));
    }

    const earningRef = db.collection('sellerEarnings').doc(earningId);
    const earningSnap = await earningRef.get();

    if (!earningSnap.exists) {
      return withCORSHeaders(NextResponse.json({ error: "Earning tidak ditemukan" }, { status: 404 }));
    }

    const earningData = earningSnap.data();

    if (earningData.payoutStatus === 'paid') {
      return withCORSHeaders(NextResponse.json({ error: "Order ini sudah ditandai lunas sebelumnya" }, { status: 400 }));
    }

    if (earningData.payoutStatus !== 'pending') {
      return withCORSHeaders(NextResponse.json({ error: `Order ini berstatus '${earningData.payoutStatus}', tidak bisa ditandai lunas` }, { status: 400 }));
    }

    // Batch ID per-order (bukan per-seller) -- tetap dipakai untuk audit trail,
    // walau isinya cuma 1 earning
    const payoutBatchId = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${earningId.slice(0, 8)}`;
    const paidAt = new Date().toISOString();

    await earningRef.update({
      payoutStatus: 'paid',
      payoutBatchId,
      paidAt,
    });

    return withCORSHeaders(NextResponse.json({
      success: true,
      earningId,
      orderId: earningData.orderId,
      sellerId: earningData.sellerId,
      payoutBatchId,
      netAmount: earningData.netAmount,
    }));

  } catch (error) {
    console.error('[Admin Mark Paid (per-earning) Error]', error);
    return withCORSHeaders(NextResponse.json({ error: error.message }, { status: 500 }));
  }
}