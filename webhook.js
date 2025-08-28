// webhook.js — 📟 VATFix Plus — Stripe listener (trial + grace, S3 idempotent, TLS mail)
import crypto from 'crypto';
import { Readable } from 'node:stream';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

const {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  S3_BUCKET,
  AWS_REGION = 'eu-north-1',
  MAIL_FROM, MAIL_FALLBACK, SMTP_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
  TRIAL_MIN_SECONDS = '0', GRACE_DAYS_AFTER_END = '7',
} = process.env;

if (!STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY');
if (!STRIPE_WEBHOOK_SECRET) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
if (!S3_BUCKET) throw new Error('Missing S3_BUCKET');

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
const s3 = new S3Client({ region: AWS_REGION });

const toInt = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const nowIso = () => new Date().toISOString();
const normEmail = (e) => (e ? String(e).trim().toLowerCase() : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readBody(stream) {
  if (typeof stream?.transformToByteArray === 'function') {
    const bytes = await stream.transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks = [];
  for await (const c of Readable.from(stream)) chunks.push(c);
  return Buffer.concat(chunks);
}
async function s3SendWithRetry(cmd, { tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await s3.send(cmd); }
    catch (e) { lastErr = e; if (i < tries - 1) await sleep(100 * Math.pow(2, i)); }
  }
  throw lastErr;
}
async function getJSON(Key) {
  try {
    const out = await s3SendWithRetry(new GetObjectCommand({ Bucket: S3_BUCKET, Key }));
    const buf = await readBody(out.Body);
    return JSON.parse(buf.toString('utf8'));
  } catch { return null; }
}
async function putJSON(Key, data) {
  await s3SendWithRetry(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  }));
}

function keyRecord({ customerId, email, key, active, trialUntil = null, graceUntil = null }) {
  return { customerId, email: normEmail(email), key, active, createdAt: nowIso(), trialUntil, graceUntil };
}
function maxIso(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return new Date(a) > new Date(b) ? a : b;
}

async function upsertEntitlement({ customerId, email, active = true, trialUntil = null, graceUntil = null }) {
  const custPath = `keys/${customerId}.json`;
  let record = await getJSON(custPath);
  if (!record?.key) {
    const key = 'sk_live_' + crypto.randomBytes(24).toString('hex');
    record = keyRecord({ customerId, email, key, active, trialUntil, graceUntil });
  } else {
    record = {
      ...record,
      email: normEmail(email) || record.email,
      active,
      trialUntil: maxIso(record.trialUntil, trialUntil),
      graceUntil: maxIso(record.graceUntil, graceUntil),
      updatedAt: nowIso(),
    };
  }
  await putJSON(custPath, record);
  await putJSON(`keys/by-key/${record.key}.json`, record);
  return record;
}
async function deactivateEntitlement(customerId, { graceUntil = null } = {}) {
  const custPath = `keys/${customerId}.json`;
  const rec = await getJSON(custPath);
  if (!rec) return null;
  const updated = {
    ...rec,
    active: false,
    deactivatedAt: nowIso(),
    graceUntil: maxIso(rec.graceUntil, graceUntil),
  };
  await putJSON(custPath, updated);
  await putJSON(`keys/by-key/${rec.key}.json`, updated);
  return updated;
}

async function primaryEmailFromCustomer(customerId) {
  try {
    const c = await stripe.customers.retrieve(String(customerId));
    return normEmail(c?.email || c?.billing_email);
  } catch { return null; }
}
function isSubInactive(sub) {
  return ['canceled', 'unpaid', 'incomplete_expired', 'paused'].includes(sub.status);
}
function isoFromEpochSeconds(sec) {
  if (!sec) return null;
  const d = new Date(Number(sec) * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function addDays(fromIso, days) {
  const d = fromIso ? new Date(fromIso) : new Date();
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString();
}

let transporter = null;
async function initMailer() {
  if (!(MAIL_FROM && (SMTP_URL || (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS)))) {
    console.warn('[mail] SMTP not configured — key emails will NOT be sent');
    return null;
  }
  const transport = SMTP_URL
    ? nodemailer.createTransport(
        SMTP_URL,
        { tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, requireTLS: true },
      )
    : nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        requireTLS: Number(SMTP_PORT) !== 465,
      });
  try {
    await transport.verify();
    console.log('[mail] SMTP ready as', MAIL_FROM);
    return transport;
  } catch (e) {
    console.error('[mail] SMTP verify failed:', e?.message || e);
    return null;
  }
}
async function ensureMailer() {
  if (!transporter) transporter = await initMailer();
  return transporter;
}

export async function emailKey(to, key) {
  if (!(await ensureMailer()) || !MAIL_FROM) return;

  let recip = normEmail(to);
  if (!recip) {
    if (MAIL_FALLBACK) {
      console.warn('[mail] No recipient email — using MAIL_FALLBACK:', MAIL_FALLBACK);
      recip = MAIL_FALLBACK;
    } else {
      console.warn('[mail] Skipped: no recipient email for key', key.slice(0, 10), '…');
      return;
    }
  }

  const endpoint = 'https://plus.vatfix.eu/vat/lookup';
  const billingPortal = 'https://billing.stripe.com/p/login/14A14o2Kk69F6Ei2hQ5wI00';

  const text = [
    'Your VATFix API key is ready.',
    '',
    `Key: ${key}`,
    `Endpoint: ${endpoint}`,
    '',
    'Headers:',
    `  x-api-key: ${key}`,
    '  x-customer-email: <billing email>',
    '',
    'Quick test (replace email/VAT):',
    'curl -sS https://plus.vatfix.eu/vat/lookup \\',
    ' -H "Content-Type: application/json" \\',
    ` -H "x-api-key: ${key}" \\`,
    ' -H "x-customer-email: you@example.com" \\',
    ` -d '{"countryCode":"DE","vatNumber":"12345678901"}' | jq .`,
    '',
    `Manage your subscription: ${billingPortal}`,
    '',
    'Stay boring, stay online.',
  ].join('\n');

  const html = String.raw`
  <div style="font:14px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111;">
    <p>Your VATFix API key is ready.</p>
    <p><b>Key:</b> <code style="padding:2px 6px;background:#f4f4f4;border-radius:6px;">${key}</code></p>
    <p><b>Endpoint:</b> <a href="${endpoint}" target="_blank" rel="noopener">${endpoint}</a></p>
    <p><b>Headers:</b></p>
    <pre style="background:#0b1021;color:#e5e7eb;padding:12px;border-radius:10px;overflow:auto">x-customer-email: &lt;billing email&gt;
x-api-key: ${key}</pre>
    <p><b>Quick test</b> (replace email/VAT):</p>
    <pre style="background:#0b1021;color:#e5e7eb;padding:12px;border-radius:10px;overflow:auto">curl -sS https://plus.vatfix.eu/vat/lookup \
 -H "Content-Type: application/json" \
 -H "x-api-key: ${key}" \
 -H "x-customer-email: you@example.com" \
 -d '{"countryCode":"DE","vatNumber":"12345678901"}' | jq .</pre>
    <p><b>Manage your subscription:</b> <a href="${billingPortal}" target="_blank" rel="noopener">${billingPortal}</a></p>
    <p>Stay boring, stay online.</p>
  </div>`;

  try {
    await transporter.sendMail({
      from: `"VATFix Plus" <${MAIL_FROM}>`,
      replyTo: 'support@vatfix.eu',
      to: recip,
      subject: '📟 VATFix Plus — Your API key',
      text,
      html,
    });
    console.log(`[mail] Key sent to ${recip}`);
  } catch (e) {
    console.error('[mail] Failed to send:', e?.message || e);
  }
}

export default async function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature');

  // Require raw body (express.raw) — accept Buffer or string
  let raw = req.body;
  if (Buffer.isBuffer(raw)) {
    // ok
  } else if (typeof raw === 'string') {
    raw = Buffer.from(raw, 'utf8');
  } else if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    raw = req.rawBody;
  } else {
    return res.status(400).send('Webhook requires raw body (express.raw)');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] Signature error:', err?.message || err);
    return res.status(400).send('Invalid signature');
  }

  // Idempotency: skip if already handled
  const eventKey = `events/${event.id}.json`;
  const seen = await getJSON(eventKey);
  if (seen?.handled) return res.status(200).send('ok');

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const sess = event.data.object;
        const customerId = sess?.customer;
        if (!customerId) break;

        let trialUntil = null;
        try {
          if (sess.subscription) {
            const sub = await stripe.subscriptions.retrieve(String(sess.subscription));
            trialUntil =
              isoFromEpochSeconds(sub.trial_end) ||
              (toInt(TRIAL_MIN_SECONDS, 0) > 0
                ? new Date(Date.now() + toInt(TRIAL_MIN_SECONDS, 0) * 1000).toISOString()
                : null);
          }
        } catch {}

        const email = normEmail(sess.customer_details?.email) || (await primaryEmailFromCustomer(customerId));
        const rec = await upsertEntitlement({ customerId, email, active: true, trialUntil });
        await emailKey(email, rec.key);
        console.log('[webhook] checkout.session.completed → entitlement ensured');
        break;
      }

      case 'invoice.payment_succeeded': {
        const inv = event.data.object;
        const customerId = inv?.customer;
        if (!customerId) break;

        let trialUntil = null;
        try {
          if (inv.subscription) {
            const sub = await stripe.subscriptions.retrieve(String(inv.subscription));
            trialUntil = isoFromEpochSeconds(sub.trial_end);
          }
        } catch {}

        const email = await primaryEmailFromCustomer(customerId);
        const rec = await upsertEntitlement({ customerId, email, active: true, trialUntil });
        if (email && rec?.key) await emailKey(email, rec.key);
        console.log('[webhook] invoice.payment_succeeded → entitlement refreshed');
        break;
      }

      case 'invoice.payment_failed': {
        // Optional: do nothing; Stripe handles dunning
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.resumed': {
        const sub = event.data.object;
        const customerId = sub?.customer;
        if (!customerId) break;

        if (isSubInactive(sub)) {
          const graceUntil = addDays(null, toInt(GRACE_DAYS_AFTER_END, 0));
          await deactivateEntitlement(customerId, { graceUntil });
          console.log('[webhook] subscription inactive → deactivated; graceUntil:', graceUntil);
        } else {
          const trialUntil = isoFromEpochSeconds(sub.trial_end);
          const email = await primaryEmailFromCustomer(customerId);
          const rec = await upsertEntitlement({ customerId, email, active: true, trialUntil });
          if (email && rec?.key) await emailKey(email, rec.key);
          console.log('[webhook] subscription active/trialing → entitlement ensured');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub?.customer;
        if (!customerId) break;

        const graceUntil = addDays(null, toInt(GRACE_DAYS_AFTER_END, 0));
        await deactivateEntitlement(customerId, { graceUntil });
        console.log('[webhook] subscription deleted → deactivated; graceUntil:', graceUntil);
        break;
      }

      default:
        console.log('[webhook] Ignored event:', event.type);
        break;
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err?.message || err);
    return res.status(500).send('Webhook error');
  }

  // Mark handled (idempotency)
  try {
    await putJSON(eventKey, { id: event.id, type: event.type, handledAt: nowIso(), handled: true });
  } catch (e) {
    // Non-fatal; Stripe may retry; handlers are idempotent
    console.warn('[webhook] Failed to write idempotency marker:', e?.message || e);
  }

  return res.status(200).send('ok');
}
