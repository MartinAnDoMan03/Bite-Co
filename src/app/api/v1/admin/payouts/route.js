// GET /api/v1/admin/payouts
// Rekap semua seller yang punya earning belum dibayar (payoutStatus: pending)

import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { verifyAdminToken } from '@/middleware/adminAuth'; // <-- DIGANTI

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req) {
  try {
    const authResult = verifyAdminToken(req); // <-- DIGANTI
    if (authResult.error) {
      return withCORSHeaders(NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 }));
    }

    const snapshot = await db.collection('sellerEarnings')
      .where('payoutStatus', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const earnings = snapshot.docs.map(doc => ({ earningId: doc.id, ...doc.data() }));

    const sellerMap = {};
    let grandTotal = 0;

    for (const earning of earnings) {
      const { sellerId, sellerName, netAmount } = earning;
      if (!sellerMap[sellerId]) {
        sellerMap[sellerId] = {
          sellerId,
          sellerName: sellerName || 'Unknown Seller',
          orderCount: 0,
          totalNetAmount: 0,
          earnings: [],
        };
      }
      sellerMap[sellerId].orderCount += 1;
      sellerMap[sellerId].totalNetAmount += netAmount;
      sellerMap[sellerId].earnings.push(earning);
      grandTotal += netAmount;
    }

    const sellers = Object.values(sellerMap).sort((a, b) => b.totalNetAmount - a.totalNetAmount);

    return withCORSHeaders(NextResponse.json({ sellers, grandTotal }));

  } catch (error) {
    console.error('[Admin Payouts GET Error]', error);
    return withCORSHeaders(NextResponse.json({ error: error.message }, { status: 500 }));
  }
}