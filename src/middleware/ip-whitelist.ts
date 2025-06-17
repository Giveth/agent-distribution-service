import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export const ipWhitelistMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.socket.remoteAddress;

    console.log('API call from Client IP:', clientIP);

    if (clientIP && config.server.allowedIPs.includes(clientIP)) {
        next();
    } else {
        res.status(401).json({
            error: 'Unauthorized: IP address not in whitelist'
        });
    }
}; 