/**
 * Authentication Middleware
 * JWT-based authentication (simplified for MVP)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../../utils';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Default user UUID (created during database migration)
const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

/**
 * Verify JWT token
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // For MVP, allow requests without auth (use default user)
      req.userId = DEFAULT_USER_ID;
      return next();
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.userId = decoded.userId;
      req.user = decoded;
      next();
    } catch (error) {
      logger.warn('Invalid JWT token');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error: any) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Generate JWT token (for testing)
 */
export function generateToken(userId: string, expiresIn: string | number = '7d'): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: expiresIn as string | number } as jwt.SignOptions);
}

/**
 * Optional auth middleware (doesn't reject unauthenticated requests)
 */
export function optionalAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.userId = decoded.userId;
        req.user = decoded;
      } catch (error) {
        // Token invalid, but continue without auth
        req.userId = DEFAULT_USER_ID;
      }
    } else {
      req.userId = DEFAULT_USER_ID;
    }
    
    next();
  } catch (error: any) {
    logger.error('Auth middleware error:', error);
    next();
  }
}

export default authMiddleware;

