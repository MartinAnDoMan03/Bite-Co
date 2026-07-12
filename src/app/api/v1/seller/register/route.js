import { db, storage } from '@/firebase/configure';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withCORSHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    // Get all form fields
    const outletName = formData.get('outletName');
    const outletPhone = formData.get('outletPhone');
    const outletEmail = formData.get('outletEmail').toLowerCase();
    const taxRate = formData.get('taxRate');
    const bankName = formData.get('bankName');
    const bankAccountNumber = formData.get('bankAccountNumber');
    const ktpFile = formData.get('ktp');
    const selfieFile = formData.get('selfie');
    const password = formData.get('password');
    const agreedTerms = formData.get('agreedTerms') === '1';
    const productHalal = formData.get('productHalal') === '1';

    // Validate required fields
    if (!outletName || !outletPhone || !outletEmail || !bankName || 
        !bankAccountNumber || !ktpFile || !selfieFile || !password || 
        !agreedTerms || !productHalal) {
      return withCORSHeaders(NextResponse.json(
        { success: false, message: 'All required fields must be provided' },
        { status: 400 }
      ));
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate unique IDs for the files
    const sellerId = db.collection('sellers').doc().id;
    const ktpFileName = `ktp-${sellerId}.jpg`;
    const selfieFileName = `selfie-${sellerId}.jpg`;

    // Upload KTP image to Firebase Storage
    const ktpBuffer = await ktpFile.arrayBuffer();
    const ktpStorageRef = storage.bucket().file(`sellers/${sellerId}/${ktpFileName}`);
    await ktpStorageRef.save(Buffer.from(ktpBuffer), {
      metadata: {
        contentType: 'image/jpeg',
      },
    });
    const ktpUrl = await ktpStorageRef.getSignedUrl({
      action: 'read',
      expires: '03-09-2491' // Far future date
    });

    // Upload selfie image to Firebase Storage
    const selfieBuffer = await selfieFile.arrayBuffer();
    const selfieStorageRef = storage.bucket().file(`sellers/${sellerId}/${selfieFileName}`);
    await selfieStorageRef.save(Buffer.from(selfieBuffer), {
      metadata: {
        contentType: 'image/jpeg',
      },
    });
    const selfieUrl = await selfieStorageRef.getSignedUrl({
      action: 'read',
      expires: '03-09-2491'
    });

    // Save seller data to Firestore
    const sellerData = {
      outletName,
      outletPhone,
      outletEmail,
      taxRate: parseFloat(taxRate) || 0,
      bankName,
      bankAccountNumber,
      ktpImageUrl: ktpUrl[0],
      selfieImageUrl: selfieUrl[0],
      password: hashedPassword, // Store the hashed password
      agreedTerms,
      productHalal,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('sellers').doc(sellerId).set(sellerData);

    return withCORSHeaders(NextResponse.json({
      success: true,
      sellerId,
      message: 'Seller registration submitted successfully'
    }));

  } catch (error) {
    console.error('Registration error:', error);
    return withCORSHeaders(NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    ));
  }
}