// lib/meter.js — S3 metering + per-key rate limiting (AWS SDK v3, best-effort)
//
// - Fixed stream handling for Node 18+ and S3 v3
// - Graceful no-S3 mode (logs once, then noop)
// - Windowed counters in S3 (minute by default)
// - Tiny audit line per request (best-effort, non-blocking)

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const {
  S3_BUCKET,
  AWS_REGION = 'eu-north-1',
  VATFIX_WINDOW_MS = '60000',   // 60s window
  VATFIX_RPS_LIMIT = '120',     // max requests per window per key
} = process.env;

const WINDOW_MS = Number.isFinite(Number(VATFIX_WINDOW_MS)) ? Number(VATFIX_WINDOW_MS) : 60000;
const LIMIT     = Number.isFinite(Number(VATFIX_RPS_LIMIT)) ? Number(VATFIX_RPS_LIMIT) : 120;

let s3 = null;
let NO_S3 = false;

if (!S3_BUCKET) {
  console.warn('[meter] S3_BUCKET not set — rate limiting disabled');
  NO_S3 = true;
} else {
  s3 = new S3Client({ region: AWS_REGION });
}

// ---------- helpers ----------
async function readBody(body) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }
  // Fallback for Node streams
  return new Promise((resolve, reject) => {
    const chunks = [];
    body.on?.('data', (c) => chunks.push(c));
    body.on?.('end', () => resolve(Buffer.concat(chunks)));
    body.on?.('error', reject);
  });
}

async function getJSON(Key) {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key }));
    const buf = await readBody(out.Body);
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

async function putJSON(Key, data) {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
      })
    );
  } catch {
    // best-effort: swallow
  }
}

function safePart(s) {
  return String(s || '')
    .replace(/[^A-Za-z0-9._-]/g, '_') // keep keys S3-friendly
    .slice(0, 128);
}

// ---------- public ----------
/**
 * Increment usage for a key within the current window and enforce the limit.
 * Returns { allowed: boolean, reason?: string, remaining?: number }
 *
 * NOTE: S3 is not transactional; this is "good enough" to slow bursts.
 * On any failure, we allow the request to proceed.
 */
export async function meterAndCheck({ apiKey, email, countryCode, vatNumber }) {
  if (NO_S3 || !apiKey) return { allowed: true, remaining: undefined };

  const now = Date.now();
  const window = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const day = new Date(window).toISOString().slice(0, 10); // YYYY-MM-DD

  const keyPart = safePart(apiKey);
  const meterKey = `meter/${day}/${keyPart}/${window}.json`;

  try {
    // read-modify-write (racy by design, but OK for coarse throttling)
    let doc = (await getJSON(meterKey)) || { count: 0, window, apiKey: keyPart, limit: LIMIT };
    doc.count = (Number(doc.count) || 0) + 1;

    // persist (best-effort)
    await putJSON(meterKey, doc);

    if (doc.count > LIMIT) {
      return { allowed: false, reason: 'rate_limit_exceeded', remaining: 0 };
    }

    // tiny audit (best-effort, fire-and-forget)
    const iso = new Date().toISOString().replace(/[:]/g, '-');
    const audit = { t: iso, apiKey: keyPart, email: String(email || '').toLowerCase(), countryCode, vatNumber };
    // don’t await
    putJSON(`logs/${day}/${iso}_${safePart(vatNumber) || 'unknown'}.json`, audit);

    return { allowed: true, remaining: Math.max(0, LIMIT - doc.count) };
  } catch (e) {
    console.error('[meter] degraded (allowing request):', e?.message || e);
    return { allowed: true, remaining: undefined };
  }
}

// Expose constants for tests / response headers
export const WINDOW_MS_CONST = WINDOW_MS;
export const LIMIT_CONST = LIMIT;

export default meterAndCheck;
