import jwt from 'jsonwebtoken';

export function verifyAdmin(request) {
  const cookie = request.cookies.get('auth-token');

  if (!cookie) {
    throw new Error('Unauthorized');
  }

  const decoded = jwt.verify(
    cookie.value,
    process.env.JWT_SECRET
  );

  if (decoded.role !== 'admin') {
    throw new Error('Forbidden');
  }

  return decoded;
}