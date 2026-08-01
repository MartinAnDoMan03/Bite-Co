import nodemailer from 'nodemailer';

// Email configuration using Hostinger SMTP
const emailConfig = {
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: 'no-reply@biteandco.id',
    pass: 'O/W6Vh3Cx[',
  },
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    // console.log('Email configuration error:', error);
  } else {
    // console.log('Email server is ready to take our messages');
  }
});

/**
 * Send OTP email to user
 * @param {string} email - Recipient email address
 * @param {string} otp - OTP code
 * @param {string} name - User's name
 * @returns {Promise<boolean>} - Success status
 */
export async function sendOTPEmail(email, otp, name) {
  try {
    const mailOptions = {
      from: {
        name: 'BiteAndCo',
        address: 'no-reply@biteandco.id',
      },
      to: email,
      subject: 'Verifikasi Email Anda - BiteAndCo',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verifikasi Email - BiteAndCo</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">BiteAndCo</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Verifikasi Email Anda</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Halo ${name}!</h2>
            
            <p>Terima kasih telah mendaftar di BiteAndCo. Untuk menyelesaikan proses registrasi, silakan verifikasi email Anda dengan memasukkan kode OTP berikut:</p>
            
            <div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <h3 style="margin: 0; color: #667eea; font-size: 32px; letter-spacing: 8px; font-weight: bold;">${otp}</h3>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404;"><strong>⚠️ Penting:</strong></p>
              <ul style="margin: 10px 0 0 20px; color: #856404;">
                <li>Kode OTP ini akan kedaluwarsa dalam <strong>5 menit</strong></li>
                <li>Jangan bagikan kode ini kepada siapa pun</li>
                <li>Jika Anda tidak mendaftar di BiteAndCo, abaikan email ini</li>
              </ul>
            </div>
            
            <p>Jika Anda mengalami kesulitan, jangan ragu untuk menghubungi tim dukungan kami.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <div style="text-align: center; color: #666; font-size: 14px;">
              <p>Salam hangat,<br><strong>Tim BiteAndCo</strong></p>
              <p style="margin-top: 20px;">
                <a href="https://www.biteandco.id" style="color: #667eea; text-decoration: none;">www.biteandco.id</a> | 
                <a href="mailto:support@biteandco.id" style="color: #667eea; text-decoration: none;">support@biteandco.id</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Halo ${name}!
        
        Terima kasih telah mendaftar di BiteAndCo. 
        
        Kode OTP Anda: ${otp}
        
        Kode ini akan kedaluwarsa dalam 5 menit.
        Jangan bagikan kode ini kepada siapa pun.
        
        Salam hangat,
        Tim BiteAndCo
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    // console.log('OTP email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
}

/**
 * Send welcome email after successful verification
 * @param {string} email - Recipient email address
 * @param {string} name - User's name
 * @returns {Promise<boolean>} - Success status
 */
export async function sendWelcomeEmail(email, name) {
  try {
    const mailOptions = {
      from: {
        name: 'BiteAndCo',
        address: 'no-reply@biteandco.id',
      },
      to: email,
      subject: 'Selamat Datang di BiteAndCo! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Selamat Datang - BiteAndCo</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Selamat Datang!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Akun Anda telah berhasil diverifikasi</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Halo ${name}!</h2>
            
            <p>Selamat! Email Anda telah berhasil diverifikasi dan akun BiteAndCo Anda siap digunakan.</p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h3 style="margin: 0 0 15px 0; color: #155724;">✅ Yang dapat Anda lakukan sekarang:</h3>
              <ul style="margin: 0; color: #155724; padding-left: 20px;">
                <li>Jelajahi catering dan rantangan terbaik di sekitar Anda</li>
                <li>Pesan makanan favorit dengan mudah</li>
                <li>Nikmati fitur Gizi Pro untuk analisis nutrisi</li>
                <li>Kelola preferensi dan profil Anda</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.biteandco.id" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Mulai Jelajahi BiteAndCo</a>
            </div>
            
            <p>Jika Anda memiliki pertanyaan atau membutuhkan bantuan, tim dukungan kami siap membantu.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <div style="text-align: center; color: #666; font-size: 14px;">
              <p>Terima kasih telah bergabung dengan kami!<br><strong>Tim BiteAndCo</strong></p>
              <p style="margin-top: 20px;">
                <a href="https://www.biteandco.id" style="color: #28a745; text-decoration: none;">www.biteandco.id</a> | 
                <a href="mailto:support@biteandco.id" style="color: #28a745; text-decoration: none;">support@biteandco.id</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    // console.log('Welcome email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
}
