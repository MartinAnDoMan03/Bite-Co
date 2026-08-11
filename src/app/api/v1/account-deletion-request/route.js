import { NextResponse } from 'next/server';
import { db } from '@/firebase/configure';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { sendAccountDeletionNotice } from '@/lib/email';


export async function OPTIONS() {
  return handleOptions();
}

// POST /api/v1/account-deletion-request
// Public endpoint (no auth) — someone requesting deletion may have already
// lost access to their account. This just queues the request for your team
// to action; it does NOT auto-delete anything (deliberately — deletion
// should be a reviewed step, not something anonymous form input triggers).
export async function POST(request) {
  try {
    const { email, phone, reason } = await request.json();

    if (!email || !email.includes('@')) {
      return withCORSHeaders(NextResponse.json(
        { success: false, message: 'A valid email address is required.' },
        { status: 400 }
      ));
    }

    await db.collection('accountDeletionRequests').add({
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      reason: reason?.trim() || null,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });

    // Don't let an email failure break the request — it's already saved in
    // Firestore either way, this is just the "someone gets notified" layer.
    sendAccountDeletionNotice(email, phone, reason).catch((err) =>
      console.error('Failed to send deletion notice email:', err)
    );

    return withCORSHeaders(NextResponse.json({
      success: true,
      message: 'Your deletion request has been received.',
    }));

  } catch (error) {
    console.error('Error saving account deletion request:', error);
    return withCORSHeaders(NextResponse.json(
      { success: false, message: 'Something went wrong. Please email biteandco2025@gmail.com directly.' },
      { status: 500 }
    ));
  }
}