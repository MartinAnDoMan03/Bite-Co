import jwt from 'jsonwebtoken';

/**
 * Verifikasi token admin dari cookie 'auth-token' (httpOnly).
 * Beda dari verifyToken (seller) yang baca dari header Authorization --
 * admin login nyimpen token di cookie, bukan header.
 *
 * @param {Request} req - NextRequest object
 * @returns {{ username, role } | { error, status }}
 */
export function verifyAdminToken(req) {
  try {
    const token = req.cookies.get('auth-token')?.value;

    if (!token) {
      return { error: 'No admin token found', status: 401 };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return { error: 'Forbidden: not an admin', status: 403 };
    }

    return { username: decoded.username, role: decoded.role };

  } catch (err) {
    return { error: 'Invalid or expired admin token', status: 401 };
  }
}