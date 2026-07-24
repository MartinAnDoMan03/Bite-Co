import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  email: 'admin@biteandco.com',
  role: 'admin'
};

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (
      username !== DEFAULT_ADMIN.username ||
      password !== DEFAULT_ADMIN.password
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid credentials'
        },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      {
        username: DEFAULT_ADMIN.username,
        role: DEFAULT_ADMIN.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d'
      }
    );

    const response = NextResponse.json({
      success: true,
      user: {
        username: DEFAULT_ADMIN.username,
        email: DEFAULT_ADMIN.email,
        role: DEFAULT_ADMIN.role
      }
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err.message
      },
      { status: 500 }
    );
  }
}