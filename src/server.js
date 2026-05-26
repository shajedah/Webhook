/**
 * Webhook Service — Main Server
 * Fastify + node:sqlite + SSE + chalk terminal logging
 * Domain: saayem.qzz.io  →  cloudflared tunnel → localhost:3000
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from './logger.js';
import { getDb } from './db.js';
import { userRoutes } from './routes/users.js';
import { webhookRoutes } from './routes/webhooks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ── Build Fastify instance ─────────────────────────────────────────────────
const fastify = Fastify({
  logger: false,          // we use our own chalk logger
  trustProxy: true,       // cloudflared sets X-Forwarded-For
  ajv: {
    customOptions: {
      removeAdditional: true,
      coerceTypes: 'array',
      useDefaults: true,
    },
  },
});

// ── Plugins ────────────────────────────────────────────────────────────────
await fastify.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

await fastify.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      connectSrc:  ["'self'"],
      imgSrc:      ["'self'", 'data:'],
    },
  },
});

await fastify.register(fastifyRateLimit, {
  global: true,
  max: 120,
  timeWindow: '1 minute',
  // Webhook trigger endpoints get a more generous limit
  keyGenerator: (req) => req.ip,
});

await fastify.register(fastifyStatic, {
  root: join(__dirname, '..', 'public'),
  prefix: '/',
});

// ── Routes ─────────────────────────────────────────────────────────────────
await fastify.register(userRoutes);
await fastify.register(webhookRoutes);

// Health check
fastify.get('/health', async () => ({
  ok: true,
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

// ── Global error handler ───────────────────────────────────────────────────
fastify.setErrorHandler((err, req, reply) => {
  if (err.validation) {
    logger.warn('Validation error', { path: req.url, message: err.message });
    return reply.code(400).send({ ok: false, error: err.message });
  }
  if (err.statusCode === 429) {
    return reply.code(429).send({ ok: false, error: 'Rate limit exceeded. Slow down.' });
  }
  logger.error('Unhandled error', { path: req.url, error: err.message });
  return reply.code(500).send({ ok: false, error: 'Internal server error' });
});

fastify.setNotFoundHandler((_req, reply) => {
  reply.code(404).send({ ok: false, error: 'Not found' });
});

// ── Boot ───────────────────────────────────────────────────────────────────
async function start() {
  // Warm up DB
  getDb();

  logger.banner();

  await fastify.listen({ port: PORT, host: HOST });

  logger.server(`Listening`, { address: `http://localhost:${PORT}` });
  logger.server(`Public URL`, { address: `https://${process.env.DOMAIN || 'saayem.qzz.io'}` });
  logger.info(`Dashboard`, { url: `http://localhost:${PORT}` });
  logger.info(`SSE feed`, { url: `http://localhost:${PORT}/api/events` });
  logger.info(`Ready — waiting for webhooks...`);
}

start().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.warn(`Received ${signal} — shutting down gracefully`);
  await fastify.close();
  logger.info('Server closed. Goodbye.');
  process.exit(0);
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
