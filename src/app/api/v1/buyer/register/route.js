import { db } from '@/firebase/configure';
import { createErrorResponse, createSuccessResponse } from '@/lib/auth';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { sendOTPEmail } from '@/lib/email';

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request) {
  try {
    const { name, email, phone, password } = await request.json();

    // Validate input
    if (!name || !email || !phone || !password) {
      return withCORSHeaders(createErrorResponse('All fields are required', 400));
    }

    // Check if email already exists
    const buyersSnapshot = await db.collection('buyers')
      .where('email', '==', email)
      .get();

    if (!buyersSnapshot.empty) {
      return withCORSHeaders(createErrorResponse('Email already registered', 400));
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 5); // OTP expires in 5 minutes

    // Create new buyer document
    const buyerRef = await db.collection('buyers').add({
      name,
      email,
      phone,
      password, // Note: In production, hash the password before storing
      emailValidated: false,
      phoneValidated: false,
      otp,
      otpExpiry: otpExpiry.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, name);
    
    if (!emailSent) {
      // Jangan kembalikan sukses jika email gagal di tahap development
      return withCORSHeaders(createErrorResponse('Registrasi berhasil, tapi gagal mengirim email OTP. Silakan hubungi admin.', 500));
    }

    return withCORSHeaders(createSuccessResponse({
      userId: buyerRef.id
    }, 'Registration successful. Please check your email for OTP.'));

  } catch (error) {
    return withCORSHeaders(createErrorResponse(error.message || 'Internal server error'));
  }
}
