import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what);
export const forbidden = (what = 'You are not allowed to do that') => new HttpError(403, what);
export const badRequest = (what: string) => new HttpError(400, what);

/** Validate input against a zod schema, turning failures into a readable 400. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue.path.length ? `${issue.path.join('.')}: ` : '';
  throw badRequest(`${field}${issue.message}`);
}

export const idParam = z.coerce.number().int().positive();

export function paramId(req: Request, name = 'id'): number {
  const result = idParam.safeParse(req.params[name]);
  if (!result.success) throw notFound();
  return result.data;
}

export function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Please log in first');
  return req.user;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if ((err as Error)?.name === 'MulterError') {
    const code = (err as { code?: string }).code;
    const message =
      code === 'LIMIT_FILE_SIZE'
        ? 'Images can be at most 8 MB'
        : code === 'LIMIT_FILE_COUNT' || code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Too many files at once'
          : (err as Error).message;
    res.status(400).json({ error: message });
    return;
  }
  const status = (err as { status?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: (err as Error).message || 'Bad request' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side' });
}
