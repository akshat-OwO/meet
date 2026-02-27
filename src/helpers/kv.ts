import { KV_MEETING_PREFIX, KV_TOKEN_PREFIX, KV_ALIAS_PREFIX, KV_EMAIL_TO_ALIAS_PREFIX } from "../constants";
import type { MeetingEntry, StoredToken } from "../types";
import { getAccessToken } from "./auth";
import { createMeetSpace } from "./meet";

/** List all meeting entries from KV (paginated). */
export async function listMeetings(kv: KVNamespace): Promise<MeetingEntry[]> {
  const entries: MeetingEntry[] = [];
  let cursor: string | undefined;

  do {
    const list = await kv.list({
      prefix: KV_MEETING_PREFIX,
      ...(cursor ? { cursor } : {}),
    });

    const page = await Promise.all(
      list.keys.map(async (key) => {
        const val = await kv.get(key.name);
        if (!val) return null;
        try {
          return JSON.parse(val) as MeetingEntry;
        } catch {
          return null;
        }
      })
    );
    entries.push(...page.filter((e): e is MeetingEntry => e !== null));

    cursor = list.list_complete ? undefined : (list.cursor as string);
  } while (cursor);

  return entries;
}

/** Get a single meeting entry by email. */
export async function getMeeting(
  kv: KVNamespace,
  email: string
): Promise<MeetingEntry | null> {
  const val = await kv.get(`${KV_MEETING_PREFIX}${email}`);
  if (!val) return null;
  try {
    return JSON.parse(val) as MeetingEntry;
  } catch {
    return null;
  }
}

/** Store a meeting entry in KV. */
export async function storeMeeting(
  kv: KVNamespace,
  email: string,
  entry: MeetingEntry
): Promise<void> {
  await kv.put(`${KV_MEETING_PREFIX}${email}`, JSON.stringify(entry));
}

/** Result of creating and storing a meeting. */
export interface CreateMeetingResult {
  entry: MeetingEntry;
  newRefreshToken?: string;
}

/** Create a meeting via the Google Meet API and store it in KV. Updates refresh token in KV if rotated. */
export async function createAndStoreMeeting(
  kv: KVNamespace,
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  email: string,
  name: string
): Promise<CreateMeetingResult> {
  const { accessToken, newRefreshToken } = await getAccessToken(refreshToken, clientId, clientSecret);
  const url = await createMeetSpace(accessToken);
  const entry: MeetingEntry = { url, name, email };
  const promises: Promise<void>[] = [storeMeeting(kv, email, entry)];
  if (newRefreshToken) {
    promises.push(storeToken(kv, email, newRefreshToken, name));
  }
  await Promise.all(promises);
  return { entry, newRefreshToken };
}

/** Store a user's refresh token and name in KV (persists across daily cron). */
export async function storeToken(
  kv: KVNamespace,
  email: string,
  refreshToken: string,
  name: string
): Promise<void> {
  const data: StoredToken = { refreshToken, name };
  await kv.put(`${KV_TOKEN_PREFIX}${email}`, JSON.stringify(data));
}

/** Retrieve a user's stored token data from KV. Handles legacy raw string format. */
export async function getStoredToken(
  kv: KVNamespace,
  email: string
): Promise<StoredToken | null> {
  const val = await kv.get(`${KV_TOKEN_PREFIX}${email}`);
  if (!val) return null;
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === "object" && parsed.refreshToken) {
      return parsed as StoredToken;
    }
    // Shouldn't happen, but treat as legacy
    return { refreshToken: val, name: email.split("@")[0] };
  } catch {
    // Legacy format: raw refresh token string
    return { refreshToken: val, name: email.split("@")[0] };
  }
}

/** Delete all meeting entries from KV (paginated). Leaves token: and alias: keys intact. */
export async function clearAllMeetings(kv: KVNamespace): Promise<number> {
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const list = await kv.list({
      prefix: KV_MEETING_PREFIX,
      ...(cursor ? { cursor } : {}),
    });
    await Promise.all(list.keys.map((key) => kv.delete(key.name)));
    deleted += list.keys.length;
    cursor = list.list_complete ? undefined : (list.cursor as string);
  } while (cursor);

  return deleted;
}

/** Generate an 8-character random hex alias (32 bits of uniform entropy). */
function generateAlias(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get or create an opaque alias for a user. Stores bidirectional mapping:
 *   alias:<id> → email
 *   email_alias:<email> → id
 * Returns the alias string. Retries on collision.
 */
export async function getOrCreateAlias(
  kv: KVNamespace,
  email: string
): Promise<string> {
  // Check if user already has an alias
  const existing = await kv.get(`${KV_EMAIL_TO_ALIAS_PREFIX}${email}`);
  if (existing) return existing;

  // Generate a new one, retry on collision (up to 5 attempts)
  for (let i = 0; i < 5; i++) {
    const alias = generateAlias();
    const taken = await kv.get(`${KV_ALIAS_PREFIX}${alias}`);
    if (taken) continue;

    await Promise.all([
      kv.put(`${KV_ALIAS_PREFIX}${alias}`, email),
      kv.put(`${KV_EMAIL_TO_ALIAS_PREFIX}${email}`, alias),
    ]);
    return alias;
  }

  throw new Error("Failed to generate unique alias after 5 attempts");
}

/** Resolve an opaque alias to an email address. Returns null if not found. */
export async function getEmailByAlias(
  kv: KVNamespace,
  alias: string
): Promise<string | null> {
  return kv.get(`${KV_ALIAS_PREFIX}${alias}`);
}
