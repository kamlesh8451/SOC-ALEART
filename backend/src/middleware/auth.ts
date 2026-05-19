import { Request, Response, NextFunction } from 'express';

export const verifyRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.headers["x-user-role"] as string || "soc_analyst";
  if (roles.includes(userRole) || userRole === "admin") {
    next();
  } else {
    res.status(403).json({ error: "Access denied: Insufficient permissions" });
  }
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
};
