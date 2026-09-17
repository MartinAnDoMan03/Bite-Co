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
            <h2 style="color: #333; margin-bottom: 20px;">Halo ${name || 'Partner'},</h2>
            
            <p style="margin-bottom: 20px;">Kami menerima permintaan untuk reset password akun seller Anda. Gunakan kode OTP berikut untuk melanjutkan proses reset password:</p>
            
            <div style="background: #f8f9fa; border: 2px dashed #FF6B00; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
              <p style="margin: 0; font-size: 14px; color: #666; margin-bottom: 10px;">Kode OTP Anda:</p>
              <h1 style="margin: 0; font-size: 36px; color: #FF6B00; letter-spacing: 8px; font-weight: bold;">${otp}</h1>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>⚠️ Penting:</strong>
              </p>
              <ul style="margin: 5px 0 0 20px; font-size: 14px; color: #856404;">
                <li>Kode OTP berlaku selama 10 menit</li>
                <li>Jangan berikan kode ini kepada siapapun</li>
                <li>Jika Anda tidak meminta reset password, abaikan email ini</li>
              </ul>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              Jika Anda mengalami masalah, silakan hubungi tim support kami di 
              <a href="mailto:support@biteandco.id" style="color: #FF6B00;">support@biteandco.id</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <div style="text-align: center; color: #999; font-size: 12px;">
              <p style="margin: 0;">© 2024 BiteAndCo. All rights reserved.</p>
              <p style="margin: 5px 0 0 0;">Email ini dikirim secara otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Reset password OTP email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending reset password OTP email:', error);
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

    // Check if seller exists
    const sellersSnapshot = await db.collection('sellers')
      .where('outletEmail', '==', email.toLowerCase())
      .get();

    if (sellersSnapshot.empty) {
      return withCORSHeaders(createErrorResponse('Email tidak terdaftar sebagai seller', 404));
    }

    const sellerDoc = sellersSnapshot.docs[0];
    const sellerData = sellerDoc.data();

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Store OTP in seller document
    await sellerDoc.ref.update({
      resetPasswordOTP: otp,
      resetPasswordOTPExpiry: otpExpiry,
      resetPasswordOTPCreatedAt: new Date()
    });

    // Send OTP email
    const emailSent = await sendResetOTPEmail(
      email,
      otp,
      sellerData.name || sellerData.outletName || sellerData.businessName
    );

    if (!emailSent) {
      return withCORSHeaders(createErrorResponse('Gagal mengirim email OTP', 500));
    }

    return withCORSHeaders(createSuccessResponse({
      message: 'OTP telah dikirim ke email Anda',
      email: email
    }));

  } catch (error) {
    console.error('Reset password request error:', error);
    return withCORSHeaders(createErrorResponse('Internal server error', 500));
  }
}
