/**
 * Premium terminal logger — Render.com style
 * Clean, structured, no duplicates, precise timestamps
 */

import chalk from 'chalk';

// ── Palette ────────────────────────────────────────────────────────────────
const c = {
  dim:      chalk.hex('#4a5568'),
  muted:    chalk.hex('#718096'),
  white:    chalk.hex('#f7fafc'),
  brand:    chalk.hex('#7c3aed'),        // purple — brand accent
  success:  chalk.hex('#10b981'),        // emerald
  info:     chalk.hex('#3b82f6'),        // blue
  warn:     chalk.hex('#f59e0b'),        // amber
  error:    chalk.hex('#ef4444'),        // red
  webhook:  chalk.hex('#06b6d4'),        // cyan — webhook events
  user:     chalk.hex('#a78bfa'),        // violet — user events
  sep:      chalk.hex('#2d3748'),
};

// ── Timestamp ──────────────────────────────────────────────────────────────
function ts() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
  });
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  return c.dim(`${date} ${time}`);
}

// ── Badge ──────────────────────────────────────────────────────────────────
function badge(label, color) {
  return color.bold(` ${label.toUpperCase()} `);
}

// ── Separator ──────────────────────────────────────────────────────────────
const SEP = c.sep('─'.repeat(72));

// ── Core log function ──────────────────────────────────────────────────────
function log(level, message, meta = null) {
  const levelMap = {
    info:    { color: c.info,    label: 'INFO   ' },
    success: { color: c.success, label: 'OK     ' },
    warn:    { color: c.warn,    label: 'WARN   ' },
    error:   { color: c.error,   label: 'ERROR  ' },
    webhook: { color: c.webhook, label: 'WEBHOOK' },
    user:    { color: c.user,    label: 'USER   ' },
    server:  { color: c.brand,   label: 'SERVER ' },
  };

  const { color, label } = levelMap[level] || levelMap.info;
  const line = `${ts()}  ${color.bold(label)}  ${c.white(message)}`;

  process.stdout.write(line + '\n');

  if (meta) {
    const entries = Object.entries(meta);
    entries.forEach(([k, v]) => {
      process.stdout.write(
        `${' '.repeat(28)}${c.muted(k.padEnd(14))} ${c.dim(String(v))}\n`
      );
    });
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
export const logger = {
  info:    (msg, meta) => log('info',    msg, meta),
  success: (msg, meta) => log('success', msg, meta),
  warn:    (msg, meta) => log('warn',    msg, meta),
  error:   (msg, meta) => log('error',   msg, meta),
  webhook: (msg, meta) => log('webhook', msg, meta),
  user:    (msg, meta) => log('user',    msg, meta),
  server:  (msg, meta) => log('server',  msg, meta),

  banner() {
    const lines = [
      '',
      SEP,
      `  ${c.brand.bold('⬡  WEBHOOK SERVICE')}   ${c.muted('discord-style · saayem.qzz.io')}`,
      `  ${c.dim('Node ' + process.version + '  ·  Fastify  ·  SQLite (node:sqlite)')}`,
      SEP,
      '',
    ];
    lines.forEach(l => process.stdout.write(l + '\n'));
  },

  webhookFired(username, webhookId, content, ip) {
    process.stdout.write('\n' + SEP + '\n');
    log('webhook', 'Incoming webhook triggered');
    process.stdout.write(
      `${' '.repeat(28)}${c.muted('username      ')} ${c.user.bold('@' + username)}\n`
    );
    process.stdout.write(
      `${' '.repeat(28)}${c.muted('webhook_id    ')} ${c.webhook(webhookId)}\n`
    );
    process.stdout.write(
      `${' '.repeat(28)}${c.muted('content       ')} ${c.white(content)}\n`
    );
    process.stdout.write(
      `${' '.repeat(28)}${c.muted('origin ip     ')} ${c.dim(ip)}\n`
    );
    process.stdout.write(SEP + '\n\n');
  },
};
