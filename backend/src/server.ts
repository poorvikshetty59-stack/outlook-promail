import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import { z } from 'zod';
import { config } from './config.js';
import { prisma } from './db.js';
import { router } from './routes.js';
import './worker.js';

const healthRedis = new Redis(config.redisUrl, {
  connectTimeout: 5000,
  maxRetriesPerRequest: 1
});

const app = express();

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use('/api', router);

app.get('/health', async (_request, response) => {
  const [postgresResult, redisResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    healthRedis.ping()
  ]);
  const postgres = postgresResult.status === 'fulfilled' ? 'connected' : 'unavailable';
  const redis = redisResult.status === 'fulfilled' ? 'connected' : 'unavailable';

  if (postgresResult.status === 'rejected') console.error('PostgreSQL health check failed', postgresResult.reason);
  if (redisResult.status === 'rejected') console.error('Redis health check failed', redisResult.reason);

  response.status(postgres === 'connected' && redis === 'connected' ? 200 : 503).json({
    ok: postgres === 'connected' && redis === 'connected',
    postgres,
    redis
  });
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('API request failed', error);

    if (response.headersSent) return;

    if (error instanceof z.ZodError) {
      return response.status(400).json({
        error:
          error.issues[0]?.message ??
          'Invalid request'
      });
    }

    response.status(500).json({
      error: 'The server could not complete the request'
    });
  }
);

app.listen(config.port, '0.0.0.0', () => {
  console.log(
    `API listening on port ${config.port}`
  );
});