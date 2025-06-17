import { Request, Response, NextFunction } from "express";
import { config } from "../config";

export const ipWhitelistMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clientIP = req.ip || req.socket.remoteAddress;

  console.log("=== IP Whitelist Check ===");
  console.log("Environment:", process.env.NODE_ENV);
  console.log("Raw ALLOWED_IPS from env:", process.env.ALLOWED_IPS);
  console.log("Processed allowed IPs:", config.server.allowedIPs);
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
