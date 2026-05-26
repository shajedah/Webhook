/**
 * SSE (Server-Sent Events) broker
 * Manages all live browser connections for real-time webhook feed
 */

// Map<clientId, { res, username? }>
const clients = new Map();
let _idCounter = 0;

export const sseBroker = {
  /**
   * Register a new SSE client connection.
   * Returns the assigned clientId so the caller can clean up on close.
   */
  add(res, username = null) {
    const id = ++_idCounter;
    clients.set(id, { res, username });
    return id;
  },

  remove(id) {
    clients.delete(id);
  },

  /**
   * Broadcast an event to all connected clients (or filtered by username).
   */
  broadcast(event, data, targetUsername = null) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [, client] of clients) {
      if (targetUsername && client.username !== targetUsername) continue;
      try {
        client.res.raw.write(payload);
      } catch {
        // client disconnected mid-write — will be cleaned up on close event
      }
    }
  },

  count() {
    return clients.size;
  },
};
