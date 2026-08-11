import { NextResponse } from 'next/server';
import { db } from '@/firebase/configure';
import jwt from 'jsonwebtoken';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request) {
  try {
    // 1. Extract JWT token with detailed validation
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      console.warn('No authorization header provided');
      return withCORSHeaders(
        NextResponse.json(
          {
            error: 'Authentication required',
            debug: 'No Authorization header found in request'
          },
          { status: 401 }
        )
      );
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.warn('Malformed authorization header:', authHeader);
      return withCORSHeaders(
        NextResponse.json(
          {
            error: 'Invalid token format',
            debug: 'Authorization header must start with "Bearer "'
          },
          { status: 401 }
        )
      );
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.warn('Empty token provided');
      return withCORSHeaders(
        NextResponse.json(
          {
            error: 'Invalid token',
            debug: 'Token is empty after "Bearer " prefix'
          },
          { status: 401 }
        )
      );
    }

    // 2. Verify JWT with detailed error handling
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);

      const debugInfo = {
        errorType: jwtError.name,
        message: jwtError.message,
        possibleCauses: [
          'Expired token',
          'Invalid signature',
          'Incorrect JWT secret',
          'Malformed token'
        ]
      };

      return withCORSHeaders(
        NextResponse.json(
          {
            error: 'Invalid token',
            debug: debugInfo
          },
          { status: 401 }
        )
      );
    }

    if (!decoded?.buyerId) {
      console.warn('Token missing buyerId:', decoded);
      return withCORSHeaders(
        NextResponse.json(
          {
            error: 'Invalid token payload',
            debug: {
              message: 'Token decoded successfully but missing buyerId',
              decodedPayload: decoded
            }
          },
          { status: 401 }
        )
      );
    }

    // 3. Query Firebase Admin DB with error context
    try {
      const userRef = db.collection('buyers').doc(decoded.buyerId);

      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.warn('No buyer found with ID:', decoded.buyerId);
        return withCORSHeaders(
          NextResponse.json(
            {
              error: 'Buyer not found',
              debug: {
                requestedId: decoded.buyerId,
                collection: 'buyers'
              }
            },
            { status: 404 }
          )
        );
      }

      // 4. Return data
      const userData = userDoc.data();

      return withCORSHeaders(
        NextResponse.json({
          name: userData.name,
          email: userData.email,
          phone: userData.phone || null,
        })
      );

    } catch (error) {
      console.error('Database operation failed:', error);
      return withCORSHeaders(
        NextResponse.json(
          {
            error: 'Database error',
            debug: {
              message: error.message,
              operation: 'Firestore get document',
              documentId: decoded.buyerId
            }
          },
          { status: 500 }
        )
      );
    }

  } catch (error) {
    console.error('Unexpected API error:', error);
    return withCORSHeaders(
      NextResponse.json(
        {
          error: 'Internal server error',
          debug: {
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          }
        },
        { status: 500 }
      )
    );
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return withCORSHeaders(
        NextResponse.json({ error: 'Authentication required or invalid format' }, { status: 401 })
      );
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return withCORSHeaders(
        NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return withCORSHeaders(
        NextResponse.json({ error: 'Invalid or expired token', debug: jwtError.message }, { status: 401 })
      );
    }

    if (!decoded?.buyerId) {
      return withCORSHeaders(
        NextResponse.json({ error: 'Invalid token payload (missing buyerId)' }, { status: 401 })
      );
    }

    try {
      const userRef = db.collection('buyers').doc(decoded.buyerId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return withCORSHeaders(
          NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
        );
      }

      await userRef.delete();

      return withCORSHeaders(
        NextResponse.json({ success: true, message: 'Akun buyer berhasil dihapus' }, { status: 200 })
      );

    } catch (dbError) {
      console.error('Database delete failed:', dbError);
      return withCORSHeaders(
        NextResponse.json({ error: 'Database delete error', debug: dbError.message }, { status: 500 })
      );
    }

  } catch (error) {
    console.error('Unexpected API error:', error);
    return withCORSHeaders(
      NextResponse.json({ error: 'Internal server error', debug: error.message }, { status: 500 })
    );
  }
}
