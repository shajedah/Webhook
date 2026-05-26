/**
 * User routes
 * POST /api/users          — register a username
 * GET  /api/users          — list all users
 * GET  /api/users/:username — get user + their webhooks
 */

import { createUser, getUserByUsername, listUsers, getWebhooksByUser } from '../db.js';
import { logger } from '../logger.js';

export async function userRoutes(fastify) {
  // Register / ensure user exists
  fastify.post('/api/users', {
    schema: {
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: {
            type: 'string',
            minLength: 2,
            maxLength: 32,
            pattern: '^[a-zA-Z0-9_-]+$',
          },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { username } = req.body;

    // Return existing user silently (idempotent)
    const existing = getUserByUsername(username);
    if (existing) {
      return reply.code(200).send({
        ok: true,
        user: { id: existing.id, username: existing.username },
        created: false,
      });
    }

    try {
      const user = createUser(username);
      logger.user(`New user registered`, { username });
      return reply.code(201).send({ ok: true, user, created: true });
    } catch (err) {
      // Race condition — another request created it
      const user = getUserByUsername(username);
      return reply.code(200).send({ ok: true, user, created: false });
    }
  });

  // List all users
  fastify.get('/api/users', async (_req, reply) => {
    const users = listUsers();
    return reply.send({ ok: true, users });
  });

  // Get user + webhooks
  fastify.get('/api/users/:username', async (req, reply) => {
    const { username } = req.params;
    const user = getUserByUsername(username);
    if (!user) {
      return reply.code(404).send({ ok: false, error: 'User not found' });
    }
    const webhooks = getWebhooksByUser(user.id);
    return reply.send({ ok: true, user, webhooks });
  });
}
