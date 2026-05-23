import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { redisConnection } from '../config/redis';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
}
const TOKEN_EXPIRY = '24h';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      console.log(`[DEBUG] Login attempt received for: ${email}`);

      console.log(`[DEBUG] Querying user from database...`);
      const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      const user = result.rows[0];

      if (!user) {
        console.log(`[DEBUG] User not found: ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      console.log(`[DEBUG] User found. Verifying password...`);
      const storedHash = user.password_hash || '';
      const isMatch = await bcrypt.compare(password, storedHash);
      
      console.log(`[DEBUG] Bcrypt compare result: ${isMatch}`);
      if (!isMatch) {
        console.log(`[DEBUG] Password mismatch for: ${email}`);
        const failedAttempts = (user.failed_attempts || 0) + 1;
        let lockedUntil = null;
        if (failedAttempts >= 5) {
          lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
        }
        await pool.query(
          'UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3',
          [failedAttempts, lockedUntil, user.id]
        );
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Successful login
      console.log(`[DEBUG] Password verified. Generating token...`);
      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

      await pool.query(
        'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Log session
      console.log(`[DEBUG] Logging session...`);
      const sessionId = uuidv4();
      await pool.query(
        'INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
        [sessionId, user.id, token, new Date(Date.now() + 24 * 60 * 60 * 1000), req.ip, req.get('user-agent')]
      );

      console.log(`[DEBUG] Login successful!`);
      res.json({ token, user: payload });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        
        // Blacklist in Redis (Safe catch)
        try {
          await redisConnection.set(`blacklist:${token}`, 'true', 'EX', 24 * 60 * 60);
        } catch (redisErr) {
          console.warn('[AUTH] Redis unavailable during logout');
        }
        
        // Delete session from DB
        await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async me(req: any, res: Response) {
    res.json(req.user);
  }
};
