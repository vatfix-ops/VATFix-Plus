// lib/entitlement.js — dev-friendly (no S3/Stripe when ENFORCE_STRIPE !== '1')
import Stripe from 'stripe';

const {
  STRIPE_SECRET_KEY,
  S3_BUCKET,
  AWS_REGION = 'eu-north-1',
  ENFORCE_STRIPE = '1',
  REQUIRE_EMAIL_MATCH = '0',
  VATFIX_PRICE_IDS = '',
  VATFIX_ALLOWED_SUB_STATUSES = 'active,trialing',
} = process.env;

const allowedPriceIds = new Set(String(VATFIX_PRICE_IDS).split(',').map(s => s.trim()).filter(Boolean));
const allowedStatuses = new Set(String(VATFIX_ALLOWED_SUB_STATUSES).split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const normEmail = (e) => (e ? String(e).trim().toLowerCase() : null);

let stripe = null;
let s3 = null;

async function getEntitlementByKeyFromS3(apiKey) {
  if (!s3) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    s3 = new S3Client({ region: AWS_REGION });
    s3._GetObjectCommand = GetObjectCommand;
  }
  try {
    const out = await s3.send(new s3._GetObjectCommand({ Bucket: S3_BUCKET, Key: `keys/by-key/${apiKey}.json` }));
    let text;
    if (typeof out.Body?.transformToByteArray === 'function') {
      text = Buffer.from(await out.Body.transformToByteArray()).toString('utf8');
    } else {
      text = await new Promise((resolve, reject) => {
        const chunks = [];
        out.Body.on('data', (c) => chunks.push(c));
        out.Body.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        out.Body.on('error', reject);
      });
    }
    return JSON.parse(text);
  } catch { return null; }
}

export async function assertActivePlus(input = {}) {
  const enforce = ENFORCE_STRIPE === '1';
  const headerEmail = normEmail(input.email);
  const headerKey = String(input.apiKey || '').trim();

  if (!enforce) {
    if (!headerKey) throw new Error('invalid_key');
    return { customerId: null, email: headerEmail, key: headerKey, active: true, source: 'no_enforce' };
  }

  if (!S3_BUCKET) throw new Error('S3_BUCKET missing');
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY missing');
  if (!stripe) stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  if (!headerKey) throw new Error('invalid_key');

  const entitlement = await getEntitlementByKeyFromS3(headerKey);
  if (!entitlement) throw new Error('invalid_key');
  if (entitlement.active === false) throw new Error('key_revoked');

  if (REQUIRE_EMAIL_MATCH === '1') {
    const entEmail = normEmail(entitlement.email);
    if (entEmail && headerEmail && entEmail !== headerEmail) throw new Error('access_denied');
  }

  let customerId = input.customerId || entitlement.customerId || null;
  let email = headerEmail || normEmail(entitlement.email) || null;

  if (!customerId && email) {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length) throw new Error('no_customer');
    customerId = customers.data[0].id;
  }
  if (!customerId) throw new Error('no_customer');

  if (!email) {
    try {
      const c = await stripe.customers.retrieve(customerId);
      if (c && !c.deleted) email = normEmail(c.email) || null;
    } catch {}
  }

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    expand: ['data.items.data.price'],
    limit: 100,
  });

  const eligible = subs.data.filter(s => allowedStatuses.has(String(s.status).toLowerCase()));
  if (!eligible.length) throw new Error('no_active_subscription');

  if (allowedPriceIds.size) {
    const ok = eligible.some(s => s.items.data.some(i => i.price && allowedPriceIds.has(i.price.id)));
    if (!ok) throw new Error('price_not_allowed');
  }

  return { customerId, email, key: entitlement.key, active: true, source: 'stripe' };
}

export default assertActivePlus;
