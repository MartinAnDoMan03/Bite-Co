import jwt from 'jsonwebtoken';

// NextResponse for API routes (only available in Next.js context)
let NextResponse
try {
  if (typeof window === 'undefined') {
    // We're on the server, try to import Next.js
    const { NextResponse: NR } = require('next/server')
    NextResponse = NR
  }
} catch (error) {
  // Next.js not available or we're in a different context
}

// Default admin credentials
const DEFAULT_ADMIN = {
  email: 'admin@biteandco.com',
  password: 'bite011004',
  username: 'admin',
  role: 'admin'
}

// Initialize default admin user - DISABLED FOR PRODUCTION
export const initializeDefaultAdmin = async () => {
  // Production: Admin users should be created manually through proper setup
  // This function is disabled for production security
  return;
}

// Simple hardcoded admin login function (no Firebase required)
export const adminLogin = async (username, password) => {
  try {
    // Simple hardcoded check
    if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
      return {
        success: true,
        user: {
          username: DEFAULT_ADMIN.username,
          email: DEFAULT_ADMIN.email,
          role: DEFAULT_ADMIN.role,
          uid: 'admin-uid-' + Date.now()
        }
      }
    }

    return {
      success: false,
      error: 'Invalid credentials.'
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: 'Login failed'
    }
  }
}

// Simple admin logout function (no Firebase required)
export const adminLogout = async () => {
  try {
    // Just clear localStorage - no Firebase signout needed
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bite-admin-user')
    }
    return { success: true }
  } catch (error) {
    console.error('Logout error:', error)
    return { success: false, error: error.message }
  }
}

// Get current admin user from localStorage
export const getCurrentAdmin = () => {
  if (typeof window !== 'undefined') {
    try {
      const storedUser = localStorage.getItem('bite-admin-user')
      if (storedUser) {
        const user = JSON.parse(storedUser)
        // Simple validation
        if (user && user.username === DEFAULT_ADMIN.username && user.role === 'admin') {
          return user
        }
      }
    } catch (error) {
      console.error('Error getting current admin:', error)
    }
  }
  return null
}

// Check if user is authenticated
export const isAuthenticated = () => {
  const user = getCurrentAdmin()
  return user !== null
}

// Legacy JWT functions for API routes
export function verifyToken(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'No token provided', status: 401 };
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    return { 
      sellerId: decoded.sellerId, 
      buyerId: decoded.buyerId,
      sellerData: decoded,
      buyerData: decoded,
      userData: decoded
    };
  } catch (error) {
    console.error('Token verification error:', error.message);
    return { error: 'Invalid token', status: 401 };
  }
}

export function verifyBuyerToken(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'No token provided', status: 401 };
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.buyerId) {
      return { error: 'Invalid buyer token', status: 401 };
    }
    
    return { 
      buyerId: decoded.buyerId,
      buyerData: decoded,
      isValid: true
    };
  } catch (error) {
    console.error('Buyer token verification error:', error.message);
    return { error: 'Invalid token', status: 401 };
  }
}

export function createErrorResponse(message, status = 500, requestId = null, debugInfo = null) {
  const errorResponse = {
    success: false,
    message,
    error: true,
    timestamp: new Date().toISOString()
  };

  if (requestId) {
    errorResponse.requestId = requestId;
  }

  if (debugInfo && process.env.NODE_ENV === 'development') {
    errorResponse.debug = debugInfo;
  }

  return NextResponse.json(errorResponse, { status });
}

export function createSuccessResponse(data, message = 'Success', requestId = null) {
  const successResponse = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
    ...data
  };

  if (requestId) {
    successResponse.requestId = requestId;
  }

  return NextResponse.json(successResponse);
}

// Utility function to generate request ID
export function generateRequestId(prefix = 'req') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Utility function to log API requests
export function logApiRequest(requestId, method, path, data = {}) {
  // console.log(`[${requestId}] ${method} ${path}`, {
  //   timestamp: new Date().toISOString(),
  //   ...data
  // });
}

// Utility function to validate email
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Utility function to validate phone number
export function isValidPhone(phone) {
  const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Utility function to sanitize user input
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
}
