/**
 * Webhook routes
 *
 * POST /api/webhooks/generate          — create a new webhook URL for a user
 * GET  /api/webhooks/:id               — get webhook info
 * POST /hooks/:webhookId               — TRIGGER a webhook (public endpoint)
 * GET  /api/events                     — SSE stream for live feed
 */

import { nanoid } from 'nanoid';
import {
  getUserByUsername,
  createWebhook,
  getWebhookById,
  getWebhooksByUser,
  incrementTriggerCount,
} from '../db.js';
import { logger } from '../logger.js';
import { sseBroker } from '../sse.js';

const DOMAIN = process.env.DOMAIN || 'saayem.qzz.io';

function buildWebhookUrl(webhookId) {
  return `https://${DOMAIN}/hooks/${webhookId}`;
}

export async function webhookRoutes(fastify) {
  // ── Generate webhook URL ─────────────────────────────────────────────────
  fastify.post('/api/webhooks/generate', {
    schema: {
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string', minLength: 2, maxLength: 32 },
          label:    { type: 'string', maxLength: 64, default: 'default' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { username, label = 'default' } = req.body;

    const user = getUserByUsername(username);
    if (!user) {
      return reply.code(404).send({ ok: false, error: 'User not found. Register first.' });
    }

    // Generate a Discord-style ID: username/nanoid
    const uniquePart = nanoid(16);
    const webhookId  = `${username}/${uniquePart}`;

    const webhook = createWebhook(user.id, webhookId, label);

    logger.success(`Webhook generated`, {
      username,
      label,
      url: buildWebhookUrl(webhookId),
    });

    return reply.code(201).send({
      ok: true,
      webhook: {
        id:    webhook.webhook_id,
        label: webhook.label,
        url:   buildWebhookUrl(webhookId),
        created_at: webhook.created_at,
      },
    });
  });

  // ── Get webhook info ─────────────────────────────────────────────────────
  fastify.get('/api/webhooks/:username/:id', async (req, reply) => {
    const webhookId = `${req.params.username}/${req.params.id}`;
    const webhook = getWebhookById(webhookId);
    if (!webhook) {
      return reply.code(404).send({ ok: false, error: 'Webhook not found' });
    }
    return reply.send({
      ok: true,
      webhook: {
        id:            webhook.webhook_id,
        label:         webhook.label,
        username:      webhook.username,
        trigger_count: webhook.trigger_count,
        url:           buildWebhookUrl(webhookId),
        created_at:    webhook.created_at,
      },
    });
  });

  // ── TRIGGER endpoint (the actual webhook) ────────────────────────────────
  // Accepts both GET (query params) and POST (JSON body)
  const triggerHandler = async (req, reply) => {
    const webhookId = `${req.params.username}/${req.params.id}`;
    const webhook = getWebhookById(webhookId);

    if (!webhook) {
      return reply.code(404).send({ ok: false, error: 'Webhook not found' });
    }

    // Extract content from body or query string
    const content =
      req.body?.content ??
      req.query?.content ??
      req.body?.message ??
      req.query?.message ??
      '(no content)';

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.ip
      || 'unknown';

    // Increment counter
    incrementTriggerCount(webhookId);

    // Premium terminal log
    logger.webhookFired(webhook.username, webhookId, String(content), ip);

    // Push to all SSE clients
    const eventPayload = {
      webhookId,
      username:  webhook.username,
      label:     webhook.label,
      content:   String(content),
      ip,
      timestamp: Date.now(),
    };
    sseBroker.broadcast('webhook', eventPayload);

    return reply.send({
      ok:        true,
      received:  true,
      username:  webhook.username,
      content:   String(content),
      timestamp: new Date().toISOString(),
    });
  };

  fastify.post('/hooks/:username/:id', triggerHandler);
  fastify.get('/hooks/:username/:id',  triggerHandler);

  // ── SSE live feed ────────────────────────────────────────────────────────
  fastify.get('/api/events', async (req, reply) => {
    const username = req.query.username || null;

    reply.raw.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',   // disable nginx buffering
    });

    // Send initial connection confirmation
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ ok: true, username })}\n\n`);

    const clientId = sseBroker.add(reply, username);

    // Heartbeat every 25 s to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25_000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      sseBroker.remove(clientId);
    });

    // Keep the handler alive — Fastify must not close the response
    await new Promise(() => {});
  });
}
