import { Request, Response, NextFunction } from "express";
import { log } from "./logger";

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) return next();

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const userId = (req as any).verifiedUid ?? "anonymous";

    log.info("api_request", {
      userId,
      method: req.method,
      endpoint: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });

  next();
}
