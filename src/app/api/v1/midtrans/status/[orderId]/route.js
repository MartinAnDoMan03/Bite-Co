import { NextResponse } from 'next/server';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import axios from 'axios';

// This route: /api/v1/midtrans/status/[orderId]
// Usage: GET /api/v1/midtrans/status/:orderId

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request, { params }) {
  try {
    const { orderId } = params;
    if (!orderId) {
      return withCORSHeaders(
        NextResponse.json({ error: 'Missing orderId in URL' }, { status: 400 })
      );
    }
    // Midtrans API credentials
    let serverKey;
    let midtransUrl;
    if (process.env.MIDTRANS_MODE === 'production') {
      serverKey = process.env.MIDTRANS_PRODUCTION_SERVER_KEY;
      midtransUrl = `https://api.midtrans.com/v2/${orderId}/status`;
    } else {
      serverKey = process.env.MIDTRANS_SANDBOX_SERVER_KEY;
      midtransUrl = `https://api.sandbox.midtrans.com/v2/${orderId}/status`;
    }
    if (!serverKey) {
      return withCORSHeaders(
        NextResponse.json({ error: 'Missing Midtrans server key' }, { status: 500 })
      );
    }
    const auth = Buffer.from(serverKey + ':').toString('base64');
    const res = await axios.get(midtransUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    // TAMBAHAN DEBUG SEMENTARA — hapus _debug_* setelah masalah ketemu
    return withCORSHeaders(
      NextResponse.json({
        ...res.data,
        _debug_serverKeyPrefix: serverKey.substring(0, 20),
        _debug_mode: process.env.MIDTRANS_MODE || 'not set (default sandbox)',
      })
    );
  } catch (error) {
    // TAMBAHAN DEBUG SEMENTARA — hapus _debug_* setelah masalah ketemu
    const debugServerKey = process.env.MIDTRANS_MODE === 'production'
      ? process.env.MIDTRANS_PRODUCTION_SERVER_KEY
      : process.env.MIDTRANS_SANDBOX_SERVER_KEY;

    return withCORSHeaders(
      NextResponse.json({
        error: 'Failed to fetch Midtrans status',
        debug: error.message,
        _debug_serverKeyPrefix: debugServerKey ? debugServerKey.substring(0, 20) : 'MISSING',
        _debug_mode: process.env.MIDTRANS_MODE || 'not set (default sandbox)',
        _debug_responseFromMidtrans: error.response?.data || null,
      }, { status: 200 }) // sementara 200 biar gampang dibuka langsung di browser
    );
  }
}