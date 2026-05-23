import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redisConnection } from '../config/redis';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    // Check Redis for blacklisted/invalidated tokens
    try {
      const isInvalid = await redisConnection.get(`blacklist:${token}`);
      if (isInvalid) {
        return res.status(401).json({ error: 'Session expired' });
      }
    } catch (redisErr) {
      console.warn('[AUTH] Redis unavailable, skipping blacklist check');
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
};

export const authorize = (permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    
    const hasPermission = req.user.permissions.includes('all') || 
      permissions.every(p => req.user?.permissions.includes(p));

    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[CRITICAL ERR]', {
    message: err.message,
    stack: err.stack,
    path: req.url,
    method: req.method,
    body: req.body
  });
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
