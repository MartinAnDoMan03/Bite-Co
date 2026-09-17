import { NextResponse } from 'next/server';
import { db } from '@/firebase/configure';
import { withCORSHeaders, handleOptions } from '@/lib/cors';
import { createErrorResponse, createSuccessResponse } from '@/lib/auth';
import nodemailer from 'nodemailer';

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email using the same email system as registration
async function sendResetOTPEmail(email, otp, name) {
  try {
    // Email configuration using Hostinger SMTP
    const emailConfig = {
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true, // Use SSL
      auth: {
        user: 'no-reply@biteandco.id',
        pass: 'Bite#011004', 
      },
    };

    // Create transporter
    const transporter = nodemailer.createTransport(emailConfig);

    const mailOptions = {
      from: {
        name: 'BiteAndCo',
        address: 'no-reply@biteandco.id',
      },
      to: email,
      subject: 'Reset Password - BiteAndCo',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Password - BiteAndCo</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #FF6B00 0%, #FFB800 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🔐 Reset Password</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">BiteAndCo</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #FF6B00; margin-top: 0;">Hi ${name || 'User'},</h2>
            
            <p>Anda telah meminta untuk mereset password akun BiteAndCo Anda. Gunakan kode OTP berikut untuk memverifikasi identitas Anda:</p>
            
            <div style="background: #f8f9fa; border: 2px dashed #FF6B00; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <h3 style="color: #FF6B00; margin: 0; font-size: 32px; letter-spacing: 8px; font-weight: bold;">${otp}</h3>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">Kode OTP Anda</p>
            </div>
            
            <div style="background: #fff3e0; border-left: 4px solid #FFB800; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #e65100;"><strong>⚠️ Penting:</strong></p>
              <ul style="margin: 10px 0 0 0; color: #e65100;">
                <li>Kode OTP ini akan kedaluwarsa dalam <strong>5 menit</strong></li>
                <li>Jangan berikan kode ini kepada siapa pun</li>
                <li>Jika Anda tidak meminta reset password, abaikan email ini</li>
              </ul>
            </div>
            
            <p>Setelah memasukkan kode OTP, Anda akan dapat membuat password baru untuk akun Anda.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #666; font-size: 14px; margin: 0;">
              Salam,<br>
              <strong>Tim BiteAndCo</strong><br>
              <a href="https://biteandco.id" style="color: #FF6B00;">biteandco.id</a>
            </p>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending reset OTP email:', error);
    return false;
  }
}

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return withCORSHeaders(createErrorResponse('Email is required', 400));
    }

    // Check if email exists in buyers collection
    const buyersSnapshot = await db.collection('buyers')
      .where('email', '==', email)
      .get();

    if (buyersSnapshot.empty) {
      return withCORSHeaders(createErrorResponse('Email not found', 404));
    }

    // Get buyer data
    const buyerDoc = buyersSnapshot.docs[0];
    const buyerData = buyerDoc.data();

    // Generate OTP and store with expiration
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in database temporarily (better for serverless)
    const buyerDocRef = buyersSnapshot.docs[0];
    const buyerId = buyerDocRef.id;
    
    // Update buyer document with OTP data
    await db.collection('buyers').doc(buyerId).update({
      resetOtp: otp,
      resetOtpExpiry: expiresAt.toISOString(),
      resetOtpVerified: false,
      updatedAt: new Date().toISOString(),
    });

    console.log('Stored OTP in database for email:', email, 'OTP:', otp, 'Expires:', expiresAt);

    // Send OTP via email
    const emailSent = await sendResetOTPEmail(email, otp, buyerData.name);

    if (!emailSent) {
      console.error('Failed to send reset OTP email');
      return withCORSHeaders(createErrorResponse('Failed to send OTP email', 500));
    }

    return withCORSHeaders(createSuccessResponse({
      message: 'OTP sent successfully'
    }));
  } catch (error) {
    console.error('Reset password request error:', error);
    return withCORSHeaders(createErrorResponse('Internal server error', 500));
  }
}
