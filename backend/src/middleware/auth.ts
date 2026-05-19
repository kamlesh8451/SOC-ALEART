import { Request, Response, NextFunction } from 'express';

export const verifyRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.headers["x-user-role"] as string || "soc_analyst";
  if (roles.includes(userRole) || userRole === "admin") {
    next();
  } else {
    res.status(403).json({ error: "Access denied: Insufficient permissions" });
  }
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  console.error(`[ERR] ${req.method} ${req.path}:`, err instanceof Error ? err.stack : err);
  
  // Also log to console if it's a database error
  if (err && typeof err === 'object' && 'code' in err) {
    console.error(`[DB CODE] ${(err as any).code}`);
  }

  if (!res.headersSent) {
    res.status(500).json({ error: message });
  }
};

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
