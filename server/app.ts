import { existsSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { csrfGuard, sessionMiddleware } from './auth';
import type { DB } from './db';
import { errorHandler, notFound } from './http';
import { authRoutes } from './routes/auth';
import { feedRoutes } from './routes/feed';
import { habitatRoutes } from './routes/habitats';
import { surveyRoutes } from './routes/surveys';
import { userRoutes } from './routes/users';
import { zooRoutes } from './routes/zoos';
import { createUploader } from './uploads';

export interface AppOptions {
  db: DB;
  uploadDir: string;
  /** Built client (vite build output). Served with an SPA fallback when it exists. */
  staticDir?: string;
  trustProxy?: boolean | string | number;
  /** Login/register attempts allowed per IP per 10 minutes. */
  authRateLimit?: number;
}

const CSP = [
  "default-src 'self'",
  "img-src 'self' https: data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function createApp({ db, uploadDir, staticDir, trustProxy = 'loopback', authRateLimit = 30 }: AppOptions) {
  const app = express();
  const upload = createUploader(uploadDir);

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    });
    next();
  });

  app.use(
    '/uploads',
    express.static(uploadDir, {
      maxAge: '365d',
      immutable: true,
      fallthrough: false,
      setHeaders: (res) => res.set('Content-Security-Policy', "default-src 'none'; sandbox"),
    }),
  );

  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));
  api.use(cookieParser());
  api.use(sessionMiddleware(db));
  api.use(csrfGuard);
  api.use('/auth', authRoutes(db, authRateLimit));
  api.use('/users', userRoutes(db));
  api.use('/zoos', zooRoutes(db, upload, uploadDir));
  api.use('/surveys', surveyRoutes(db));
  api.use('/feed', feedRoutes(db));
  api.use('/', habitatRoutes(db, upload, uploadDir));
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.use(() => {
    throw notFound('No such API endpoint');
  });
  app.use('/api', api);

  if (staticDir && existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.set('Content-Security-Policy', CSP);
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
