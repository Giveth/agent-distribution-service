import { Request, Response, NextFunction } from "express";
import { config } from "../config";

export const ipWhitelistMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip IP check in production if no IPs are configured
  if (
    config.environment === "production" &&
    config.server.allowedIPs.length === 0
  ) {
    return next();
  }

  const clientIP = req.ip || req.socket.remoteAddress;

  if (clientIP && config.server.allowedIPs.includes(clientIP)) {
    next();
  } else {
    res.status(401).json({
      error: "Unauthorized: IP address not in whitelist",
    });
  }
};
