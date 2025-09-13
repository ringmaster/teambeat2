// Presence system constants
export const PRESENCE_TIMEOUT_MS = 30 * 1000; // 30 seconds
export const PRESENCE_PING_INTERVAL_MS = 20 * 1000; // 20 seconds (send ping before timeout)
export const PRESENCE_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute cleanup interval

// SSE heartbeat constants
export const SSE_HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
export const SSE_STALE_CONNECTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
