import { db } from '@/firebase/configure';
import { verifyToken, createSuccessResponse, createErrorResponse } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

// POST /api/v1/seller/register-push-token
// Stores the seller's Expo push token so new-order notifications can
// actually be delivered. The sellerId is taken from the verified JWT
// rather than trusting whatever the client sends.
export async function POST(request) {
  try {
    const authResult = verifyToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status || 401));
    }

    const { sellerId } = authResult;
    if (!sellerId) {
      return withCORSHeaders(createErrorResponse('Invalid seller token', 401));
    }

    const { pushToken } = await request.json();

    if (!pushToken) {
      return withCORSHeaders(createErrorResponse('Missing pushToken', 400));
    }

    await db.collection('sellers').doc(sellerId).update({
      expoPushToken: pushToken,
      pushTokenUpdatedAt: new Date().toISOString(),
    });

    return withCORSHeaders(createSuccessResponse({ message: 'Push token registered' }));
  } catch (error) {
    console.error('Error registering seller push token:', error);
    return withCORSHeaders(createErrorResponse(error.message));
  }
}