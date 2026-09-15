import { createServerFn } from "@tanstack/react-start";

export interface WorkspaceSyncPayload {
  displayName?: string | null;
  examName?: string | null;
  theme?: string | null;
  streak?: number;
  totalAttempts?: number;
  totalMcqs?: number;
  accuracy?: number | null;
  syncedAt?: string;
  sourceDevice?: string;
}

export interface PairingSessionRecord {
  code: string;
  token: string;
  payload: WorkspaceSyncPayload;
  createdAt: number;
  expiresAt: number;
}

// In-memory pairing sessions cache with 15-minute TTL
// Stored in global scope to persist across server function calls in Nitro/Node
const globalStore = globalThis as unknown as {
  __studySparkPairingSessions?: Map<string, PairingSessionRecord>;
};

if (!globalStore.__studySparkPairingSessions) {
  globalStore.__studySparkPairingSessions = new Map<string, PairingSessionRecord>();
}

const pairingSessions = globalStore.__studySparkPairingSessions;

// Clean up expired sessions periodically
function purgeExpiredSessions() {
  const now = Date.now();
  for (const [code, session] of pairingSessions.entries()) {
    if (session.expiresAt < now) {
      pairingSessions.delete(code);
    }
  }
}

/**
 * Creates a new cross-device pairing session and generates a 6-character PIN
 */
export const createDevicePairingSession = createServerFn({ method: "POST" })
  .validator((input: unknown) => (input ?? {}) as { payload: WorkspaceSyncPayload })
  .handler(async ({ data }) => {
    purgeExpiredSessions();

    // Generate unique 6-digit alphanumeric PIN: e.g. "SPARK-4821" or "784920"
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const pairingCode = `SPARK-${randomDigits.slice(0, 4)}`;
    const sessionToken = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes TTL

    const record: PairingSessionRecord = {
      code: pairingCode,
      token: sessionToken,
      payload: {
        ...data.payload,
        syncedAt: new Date().toISOString(),
      },
      createdAt: now,
      expiresAt,
    };

    pairingSessions.set(pairingCode, record);
    pairingSessions.set(sessionToken, record);

    return {
      success: true,
      code: pairingCode,
      token: sessionToken,
      expiresAt,
      ttlSeconds: Math.floor((expiresAt - now) / 1000),
    };
  });

/**
 * Resolves a pairing session using a 6-digit PIN or session token
 */
export const resolveDevicePairingSession = createServerFn({ method: "POST" })
  .validator((input: unknown) => (input ?? {}) as { query: string })
  .handler(async ({ data }) => {
    purgeExpiredSessions();

    const queryKey = data.query?.trim().toUpperCase();
    if (!queryKey) {
      return { success: false, error: "Pairing code or token required" };
    }

    // Try finding by exact code or without "SPARK-" prefix
    let session = pairingSessions.get(queryKey);
    if (!session && !queryKey.startsWith("SPARK-")) {
      session = pairingSessions.get(`SPARK-${queryKey}`);
    }

    if (!session) {
      // Search token map
      for (const item of pairingSessions.values()) {
        if (item.token === data.query.trim()) {
          session = item;
          break;
        }
      }
    }

    if (!session) {
      return {
        success: false,
        error: "Pairing session not found or has expired. Please generate a new QR code.",
      };
    }

    if (session.expiresAt < Date.now()) {
      pairingSessions.delete(session.code);
      pairingSessions.delete(session.token);
      return {
        success: false,
        error: "Pairing session has expired. Please generate a new QR code.",
      };
    }

    return {
      success: true,
      code: session.code,
      payload: session.payload,
      expiresAt: session.expiresAt,
    };
  });
