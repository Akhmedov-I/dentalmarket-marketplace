import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Augment Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existing = req.headers['x-request-id'] as string | undefined;
    const requestId = existing || `req_${uuidv4()}`;

    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
