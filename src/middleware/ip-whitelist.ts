import { Request, Response, NextFunction } from "express";
import { config } from "../config";

export const ipWhitelistMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get the real client IP from X-Forwarded-For header or fallback to req.ip
  const forwardedFor = req.headers["x-forwarded-for"];
  const clientIP = forwardedFor
    ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
        .split(",")[0]
        .trim()
    : req.ip || req.socket.remoteAddress;

  console.log("=== IP Whitelist Check ===");
  console.log("Environment:", process.env.NODE_ENV);
  console.log("Raw ALLOWED_IPS from env:", process.env.ALLOWED_IPS);
  console.log("Processed allowed IPs:", config.server.allowedIPs);
  console.log("X-Forwarded-For header:", req.headers["x-forwarded-for"]);
  console.log("Client IP:", clientIP);
  console.log(
    "Is IP allowed:",
    clientIP && config.server.allowedIPs.includes(clientIP)
  );
  console.log("========================");

  if (clientIP && config.server.allowedIPs.includes(clientIP)) {
    next();
  } else {
    res.status(401).json({
      error: "Unauthorized: IP address not in whitelist",
    });
  }
};
