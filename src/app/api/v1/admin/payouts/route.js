// GET /api/v1/admin/payouts
// Rekap semua seller yang punya earning belum dibayar (payoutStatus: pending)

import { NextResponse } from "next/server";
import { db } from "@/firebase/configure";
import { withCORSHeaders, handleOptions } from '@/lib/cors';
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
          // Diisi belakangan setelah fetch data seller
          bankName: null,
          bankAccountNumber: null,
          hasBankInfo: false,
        };
      }
      sellerMap[sellerId].orderCount += 1;
      sellerMap[sellerId].totalNetAmount += netAmount;
      sellerMap[sellerId].earnings.push(earning);
      grandTotal += netAmount;
    }

    // Ambil data rekening bank tiap seller yang muncul di rekap.
    // Dilakukan sekali per sellerId unik (bukan per earning), biar nggak
    // fetch dokumen sellers berkali-kali kalau 1 seller punya banyak order.
    const sellerIds = Object.keys(sellerMap);
    await Promise.all(
      sellerIds.map(async (sellerId) => {
        try {
          const sellerDoc = await db.collection('sellers').doc(sellerId).get();
          if (sellerDoc.exists) {
            const sellerData = sellerDoc.data();
            const bankName = sellerData.bankName || null;
            const bankAccountNumber = sellerData.bankAccountNumber || null;
            sellerMap[sellerId].bankName = bankName;
            sellerMap[sellerId].bankAccountNumber = bankAccountNumber;
            // Seller lama (mis. daftar sebelum field ini ada di form onboarding)
            // bisa saja tidak punya data ini sama sekali.
            sellerMap[sellerId].hasBankInfo = !!(bankName && bankAccountNumber);
          }
        } catch (err) {
          console.error('[Admin Payouts] Gagal fetch data seller:', sellerId, err);
          // Biarkan hasBankInfo tetap false — halaman admin akan menandai
          // seller ini butuh dilengkapi datanya dulu.
        }
      })
    );

    const sellers = Object.values(sellerMap).sort((a, b) => b.totalNetAmount - a.totalNetAmount);

    return withCORSHeaders(NextResponse.json({ sellers, grandTotal }));

  } catch (error) {
    console.error('[Admin Payouts GET Error]', error);
    return withCORSHeaders(NextResponse.json({ error: error.message }, { status: 500 }));
  }
}