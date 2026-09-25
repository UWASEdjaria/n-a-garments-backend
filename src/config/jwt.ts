import jwt, { SignOptions } from 'jsonwebtoken';
import { JwtPayload } from '../interfaces/auth.interface';

export type { JwtPayload };

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  console.warn('⚠️ WARNING: JWT_SECRET environment variable is not defined.');
}

export const generateToken = (payload: JwtPayload): string => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured on the server.');
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] });
};

export const verifyToken = (token: string): JwtPayload => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured on the server.');
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};
