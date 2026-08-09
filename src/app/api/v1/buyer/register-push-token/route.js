import { db } from '@/firebase/configure';
import { verifyBuyerToken, createSuccessResponse, createErrorResponse } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

// POST /api/v1/buyer/register-push-token
// Stores the buyer's Expo push token so order-status notifications can
// actually be delivered. The buyerId is taken from the verified JWT rather
// than trusting whatever the client sends, so a buyer can't overwrite
// another buyer's push token.
export async function POST(request) {
  try {
    const authResult = verifyBuyerToken(request);
    if (authResult.error) {
      return withCORSHeaders(createErrorResponse(authResult.error, authResult.status || 401));
    }

    const { buyerId } = authResult;
    const { pushToken } = await request.json();

    if (!pushToken) {
      return withCORSHeaders(createErrorResponse('Missing pushToken', 400));
    }

    await db.collection('buyers').doc(buyerId).update({
      expoPushToken: pushToken,
      pushTokenUpdatedAt: new Date().toISOString(),
    });

    return withCORSHeaders(createSuccessResponse({ message: 'Push token registered' }));
  } catch (error) {
    console.error('Error registering buyer push token:', error);
    return withCORSHeaders(createErrorResponse(error.message));
  }
}