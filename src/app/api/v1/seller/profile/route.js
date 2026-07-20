import { NextResponse } from 'next/server';
import { db, storage } from '@/firebase/configure'; // Import storage
import jwt from 'jsonwebtoken';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

// Helper function to parse multipart/form-data using request.formData()
async function parseMultipartForm(req) {
  // Use the native formData API (like in menu/route.js)
  const formData = await req.formData();
  const fields = {};
  const files = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === 'object' && value && value.arrayBuffer) {
      // It's a file
      files[key] = value;
    } else {
      fields[key] = value;
    }
  }
  return { fields, files };
}

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

    if (!decoded?.sellerId) {
      console.warn('Token missing sellerId:', decoded);
      return withCORSHeaders(
        NextResponse.json(
          {
            error: 'Invalid token payload',
            debug: {
              message: 'Token decoded successfully but missing sellerId',
              decodedPayload: decoded
            }
          },
          { status: 401 }
        )
      );
    }

    // 3. Query Firebase Admin DB with error context
    try {
      const userRef = db.collection('sellers').doc(decoded.sellerId);

      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.warn('No seller found with ID:', decoded.sellerId);
        return withCORSHeaders(
          NextResponse.json(
            {
              error: 'Seller not found',
              debug: {
                requestedId: decoded.sellerId,
                collection: 'sellers'
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
          name: userData.outletName,
          email: userData.outletEmail,
          phone: userData.outletPhone || null,
          address: userData.address || null,
          kelurahan: userData.kelurahan || null,
          kecamatan: userData.kecamatan || null,
          provinsi: userData.provinsi || null,
          kodePos: userData.kodePos || null,
          catatan: userData.catatan || null,
          storeIcon: userData.storeIcon || null, // Include storeIcon
          storeBanner: userData.storeBanner || null, // Include storeBanner
          pinLat: userData.pinLat || null,
          pinLng: userData.pinLng || null,
          pinAddress: userData.pinAddress || null,
          openTime: userData.openTime || null,
          closeTime: userData.closeTime || null,
          isManuallyClosed: userData.isManuallyClosed || false,
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
              documentId: decoded.sellerId
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

export async function PUT(request) {
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

    if (!decoded?.sellerId) {
      console.warn('Token missing sellerId:', decoded);
      return withCORSHeaders(
        NextResponse.json(
          {
            error: 'Invalid token payload',
            debug: {
              message: 'Token decoded successfully but missing sellerId',
              decodedPayload: decoded
            }
          },
          { status: 401 }
        )
      );
    }

    // 3. Parse multipart form data
    const { fields, files } = await parseMultipartForm(request);

    const {
      name,
      phone,
      address,
      kelurahan,
      kecamatan,
      provinsi,
      kodePos,
      catatan,
      pinLat,
      pinLng,
      pinAddress,
      openTime,
      closeTime,
      isManuallyClosed,
    } = fields;

    let storeIconURL = null;
    let storeBannerURL = null;

    // Handle storeIcon upload
    if (files.storeIcon) {
      const file = files.storeIcon;
      const bucket = storage.bucket();
      const uuid = uuidv4();
      const storagePath = `sellers/${decoded.sellerId}/storeIcon/${uuid}-${file.name || 'icon.jpg'}`;
      const buffer = await file.arrayBuffer();
      const fileRef = bucket.file(storagePath);
      await fileRef.save(Buffer.from(buffer), {
        metadata: {
          contentType: file.type || 'image/jpeg',
          metadata: {
            firebaseStorageDownloadTokens: uuid,
          },
        },
      });
      storeIconURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${uuid}`;
    }

    // Handle storeBanner upload
    if (files.storeBanner) {
      const file = files.storeBanner;
      const bucket = storage.bucket();
      const uuid = uuidv4();
      const storagePath = `sellers/${decoded.sellerId}/storeBanner/${uuid}-${file.name || 'banner.jpg'}`;
      const buffer = await file.arrayBuffer();
      const fileRef = bucket.file(storagePath);
      await fileRef.save(Buffer.from(buffer), {
        metadata: {
          contentType: file.type || 'image/jpeg',
          metadata: {
            firebaseStorageDownloadTokens: uuid,
          },
        },
      });
      storeBannerURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${uuid}`;
    }

    // 4. Validate required fields
    if (
      !name && !phone && !address && !kelurahan && !kecamatan && !provinsi &&
      !kodePos && !catatan && !storeIconURL && !storeBannerURL &&
      !openTime && !closeTime && isManuallyClosed === undefined
    ) {
      console.warn('No fields provided for profile update');
      return withCORSHeaders(
        NextResponse.json(
          {
            error: 'No fields provided',
            debug: {
              message: 'At least one field or image must be provided.'
            }
          },
          { status: 400 }
        )
      );
    }

    // 5. Update Firebase document
    try {
      const userRef = db.collection('sellers').doc(decoded.sellerId);

      const updateData = {};
      if (name) updateData.outletName = name;
      if (phone) updateData.outletPhone = phone;
      if (address) updateData.address = address;
      if (kelurahan) updateData.kelurahan = kelurahan;
      if (kecamatan) updateData.kecamatan = kecamatan;
      if (provinsi) updateData.provinsi = provinsi;
      if (kodePos) updateData.kodePos = kodePos;
      if (catatan) updateData.catatan = catatan;
      if (storeIconURL) updateData.storeIcon = storeIconURL;
      if (storeBannerURL) updateData.storeBanner = storeBannerURL;
      if (pinLat) updateData.pinLat = pinLat;
      if (pinLng) updateData.pinLng = pinLng;
      if (pinAddress) updateData.pinAddress = pinAddress;
      // Jam operasional — openTime/closeTime dicek terpisah dari isManuallyClosed
      // karena isManuallyClosed boolean (dikirim sebagai string 'true'/'false' lewat
      // FormData), jadi nggak bisa pakai `if (isManuallyClosed)` biasa (string 'false'
      // itu truthy, bakal ke-skip terus kalau begitu)
      if (openTime) updateData.openTime = openTime;
      if (closeTime) updateData.closeTime = closeTime;
      if (isManuallyClosed !== undefined) updateData.isManuallyClosed = isManuallyClosed === 'true';
      updateData.updatedAt = new Date().toISOString();

      await userRef.update(updateData);

      // 6. Respond with success message
      // PENTING: field `success: true` wajib ada — frontend (handleSave di
      // Profile.jsx) ngecek `response.data.success` buat nentuin apakah lanjut
      // keluar dari mode edit + refresh data. Tanpa field ini, response tetap
      // 200 OK dan data tetap kesimpen ke Firestore, tapi UI seller nggak akan
      // pernah keluar dari mode edit karena kondisinya nggak pernah true.
      console.log('Seller profile updated successfully:', decoded.sellerId);
      return withCORSHeaders(NextResponse.json({ success: true, message: 'Profile updated successfully' }));

    } catch (dbError) {
      console.error('Database update failed:', dbError);
      return withCORSHeaders(
        NextResponse.json(
          {
            error: 'Database update error',
            debug: {
              message: dbError.message,
              operation: 'Firestore update document',
              documentId: decoded.sellerId
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

export const config = {
  api: {
    bodyParser: false,
  },
};