import jwt, { SignOptions } from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  role: 'CUSTOMER' | 'ADMIN';
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  console.warn('⚠️ WARNING: JWT_SECRET environment variable is not defined.');
}

/**
 * Generates a signed JWT token for an authenticated user.
 */
export const generateToken = (payload: JwtPayload): string => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured on the server.');
  }

  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, JWT_SECRET, options);
};

/**
 * Verifies and decodes a given JWT token.
 * Throws an error if the token is invalid or expired.
 */
export const verifyToken = (token: string): JwtPayload => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured on the server.');
  }

  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};