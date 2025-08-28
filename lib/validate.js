// lib/validate.js — 📟 VATFix Plus — VIES lookup with S3 cache + stale-on-error
// - Only caches meaningful payloads (valid || name || address)
// - Ignores + deletes empty cached entries
// - Supports cache namespace bump via CACHE_NS

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

const {
  S3_BUCKET,
  AWS_REGION = 'eu-north-1',
  CACHE_TTL_HOURS = '12',
  VIES_URL = 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService',
  VIES_TIMEOUT_MS = '8000',
  VIES_RETRIES = '2',
  CACHE_NS = 'v2', // bump this to nuke old cache keys without S3 ops
} = process.env;

if (!S3_BUCKET) throw new Error('Missing S3_BUCKET');

const s3 = new S3Client({ region: AWS_REGION });

/* ---------------- Utils ---------------- */
const toInt = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const nowIso = () => new Date().toISOString();
const hoursToMs = (h) => toInt(h, 0) * 3600_000;

async function readBody(stream) {
  if (typeof stream?.transformToByteArray === 'function') {
    const bytes = await stream.transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks = [];
  for await (const c of Readable.from(stream)) chunks.push(c);
  return Buffer.concat(chunks);
}

async function s3GetJson(Key) {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key }));
    const buf = await readBody(out.Body);
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}
async function s3PutJson(Key, data) {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    })
  );
}
async function s3Delete(Key) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key }));
  } catch {
    /* ignore */
  }
}

/* ---------------- Input normalization ---------------- */
function normalizeInput({ countryCode, vatNumber }) {
  let cc = String(countryCode || '').trim().toUpperCase();
  let vn = String(vatNumber || '').trim();

  // Allow "DE123..." form
  const m = vn.match(/^([A-Za-z]{2})(.+)$/);
  if (!cc && m) {
    cc = m[1].toUpperCase();
    vn = m[2];
  }
  if (cc === 'GR') cc = 'EL'; // Greece

  vn = vn.replace(/[\s.-]/g, '');
  return { countryCode: cc, vatNumber: vn };
}

/* ---------------- SOAP helpers ---------------- */
function buildSoapEnvelope(cc, vn) {
  return String.raw`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${cc}</urn:countryCode>
      <urn:vatNumber>${vn}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Namespace-safe tag matcher
function tag(xml, t) {
  const re = new RegExp(`<(?:\\w+:)?${t}>([\\s\\S]*?)</(?:\\w+:)?${t}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function parseVies(xml) {
  if (/<Fault>/i.test(xml)) {
    const fault = tag(xml, 'faultstring') || 'SOAP Fault';
    const detail = tag(xml, 'message') || '';
    const err = new Error(`${fault}${detail ? `: ${detail}` : ''}`);
    err.viesFault = true;
    throw err;
  }

  const valid = /^true$/i.test(tag(xml, 'valid') || '');
  let name = (tag(xml, 'name') || tag(xml, 'traderName') || '').replace(/\s+/g, ' ').trim();
  let addressRaw = (tag(xml, 'address') || tag(xml, 'traderAddress') || '').trim();

  if (name === '---' || name === '-----') name = '';
  if (/^-+$/.test(addressRaw)) addressRaw = '';

  const address = addressRaw.replace(/\s*\n\s*/g, '\n').trim();

  return {
    valid,
    name,
    address,
    requestDate: tag(xml, 'requestDate') || null,
    countryCode: tag(xml, 'countryCode') || null,
    vatNumber: tag(xml, 'vatNumber') || null,
  };
}

/* ---------------- HTTP ---------------- */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function callVies(cc, vn) {
  const body = buildSoapEnvelope(cc, vn);
  const res = await fetchWithTimeout(
    VIES_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Accept: 'text/xml',
        SOAPAction: 'urn:ec.europa.eu:taxud:vies:services:checkVat:types#checkVat',
        'User-Agent': 'VATFix-Plus/1.0 (+https://plus.vatfix.eu)',
      },
      body,
    },
    toInt(VIES_TIMEOUT_MS, 8000)
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`VIES HTTP ${res.status}`);
    err.status = res.status;
    err.body = text.slice(0, 512);
    throw err;
  }
  return parseVies(await res.text());
}

function isTransient(err) {
  if (err?.viesFault) {
    const msg = String(err.message || '').toUpperCase();
    if (/(INVALID_INPUT|MS_INVALID_INPUT)/.test(msg)) return false;
    return /(SERVICE_UNAVAILABLE|MS_UNAVAILABLE|TIMEOUT)/.test(msg);
  }
  return err?.name === 'AbortError' || (err?.status >= 500) || /ECONNRESET|ETIMEDOUT/.test(err?.code || '');
}

async function callViesWithRetry(cc, vn) {
  const attempts = 1 + toInt(VIES_RETRIES, 2);
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callVies(cc, vn);
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1 && isTransient(e)) {
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, i)));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

/* ---------------- Cache ---------------- */
function cacheKey(cc, vn) {
  const safe = vn.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `cache/${CACHE_NS}/${cc}/${safe}.json`;
}
function isFresh(cached, ttlMs) {
  if (!cached?.cachedAt) return false;
  return Date.now() - new Date(cached.cachedAt).getTime() < ttlMs;
}
function isMeaningfulPayload(p) {
  if (!p || typeof p !== 'object') return false;
  return Boolean(p.valid || (p.name && p.name.trim()) || (p.address && p.address.trim()));
}

/* ---------------- Public API ---------------- */
export default async function checkVAT({ countryCode, vatNumber }) {
  const { countryCode: ccIn, vatNumber: vnIn } = normalizeInput({ countryCode, vatNumber });
  if (!ccIn || !vnIn) {
    return { error: 'invalid_input', message: 'countryCode and vatNumber are required' };
  }

  const ttlMs = hoursToMs(CACHE_TTL_HOURS || '12');
  const key = cacheKey(ccIn, vnIn);
  const cached = await s3GetJson(key);

  // If cache exists but is empty/useless, delete and ignore it
  if (cached && !isMeaningfulPayload(cached.payload)) {
    await s3Delete(key);
  } else if (isFresh(cached, ttlMs)) {
    const ageSec = Math.floor((Date.now() - new Date(cached.cachedAt).getTime()) / 1000);
    return {
      ...cached.payload,
      source: 'cache',
      cachedAt: cached.cachedAt,
      cacheAgeSeconds: ageSec,
      stale: false,
    };
  }

  // Live call
  try {
    const live = await callViesWithRetry(ccIn, vnIn);
    const payload = {
      countryCode: live.countryCode || ccIn,
      vatNumber: (live.vatNumber || vnIn).replace(/[\s.-]/g, ''),
      valid: !!live.valid,
      name: live.name || '',
      address: live.address || '',
      requestDate: live.requestDate || new Date().toISOString().slice(0, 10),
    };

    const meaningful = isMeaningfulPayload(payload);
    if (meaningful) {
      const stamp = nowIso();
      await s3PutJson(key, { cachedAt: stamp, payload });
      return { ...payload, source: 'live', cachedAt: stamp, cacheAgeSeconds: 0, stale: false };
    }

    // Don’t poison cache with empty payloads
    return { ...payload, source: 'live', stale: false };
  } catch (e) {
    // Stale-on-error only if the cache is meaningful
    if (cached?.payload && isMeaningfulPayload(cached.payload)) {
      const ageSec = Math.floor((Date.now() - new Date(cached.cachedAt).getTime()) / 1000);
      return {
        ...cached.payload,
        source: 'cache',
        cachedAt: cached.cachedAt,
        cacheAgeSeconds: ageSec,
        stale: true,
      };
    }

    const reason =
      e?.name === 'AbortError'
        ? 'vies_timeout'
        : e?.status
        ? `vies_http_${e.status}`
        : e?.viesFault
        ? 'vies_fault'
        : 'vies_unavailable';

    return { error: reason, message: e?.message || 'VIES unavailable' };
  }
}
