import jwt from 'jsonwebtoken';
import { JWTPayload, RefreshToken } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-access-secret-key';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';

export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload as any, JWT_SECRET as any, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
  } as any);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET as any) as JWTPayload;
};

export const verifyRefreshTokenExpiration = (refreshToken: RefreshToken) => {
    return refreshToken.expiresAt.getTime() < new Date().getTime();
};