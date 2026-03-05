import { Request, Response } from 'express';
import logger from '../logger';

function isHeadersSentError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ERR_HTTP_HEADERS_SENT'
    || error.message.includes('Cannot set headers after they are sent');
}

export function handleError(req: Request, res: Response, statusCode: number, errorMessage: string | unknown): void {
  if (res.headersSent || res.writableEnded || res.writableFinished) {
    logger.warn(`Skipped error response because headers were already sent for ${req.method} ${req.originalUrl}`, 'API');
    return;
  }

  try {
    if (req.accepts('json')) {
      res.status(statusCode).json({ error: errorMessage });
    } else {
      res.status(statusCode).send(errorMessage);
    }
  } catch (error) {
    if (isHeadersSentError(error)) {
      logger.warn(`Skipped duplicate error response for ${req.method} ${req.originalUrl}: ${(error as Error).message}`, 'API');
      return;
    }
    logger.err(`Failed to send error response for ${req.method} ${req.originalUrl}: ${error instanceof Error ? error.message : error}`, 'API');
  }
}
