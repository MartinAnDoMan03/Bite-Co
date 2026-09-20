import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/middleware/adminAuth';

export async function GET(req) {
  const result = verifyAdminToken(req);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ username: result.username, role: result.role });
}