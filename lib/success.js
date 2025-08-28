// success.js — 📟 VATFix Plus — Checkout success page (Stripe + S3)

import Stripe from 'stripe';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

/* --- Env --- */
const {
  STRIPE_SECRET_KEY,
  S3_BUCKET,
  AWS_REGION = 'eu-north-1',
  MARKETING_ORIGIN = 'https://plus.vatfix.eu',
} = process.env;

if (!STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY');
if (!S3_BUCKET) throw new Error('Missing S3_BUCKET');

/* --- Clients --- */
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
const s3 = new S3Client({ region: AWS_REGION });

/* --- Utils --- */
async function s3GetJson(Key) {
  const out = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key }));
  const body = out.Body;
  let buf;
  if (typeof body?.transformToByteArray === 'function') {
    buf = Buffer.from(await body.transformToByteArray());
  } else {
    buf = await new Promise((resolve, reject) => {
      const chunks = [];
      body.on('data', (c) => chunks.push(c));
      body.on('end', () => resolve(Buffer.concat(chunks)));
      body.on('error', reject);
    });
  }
  return JSON.parse(buf.toString('utf8'));
}

export function setSuccessCsp(res) {
  res.set('Cache-Control', 'no-store');
  res.set('X-Frame-Options', 'DENY');
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'unsafe-inline'; img-src data: https:; frame-ancestors 'none'"
  );
}

const endpoint = 'https://plus.vatfix.eu/vat/lookup';

export function renderSuccessHtml({ key, email, portalUrl }) {
  return String.raw`<!doctype html><meta charset="utf-8">
<title>📟 VATFix Plus — Your API Key</title>
<style>
  body{font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px;max-width:820px;color:#111}
  code,pre{font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  pre{background:#0b1021;color:#e5e7eb;padding:14px;border-radius:12px;overflow:auto}
  .btn{display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none}
  .muted{color:#555}
  a{color:#2563eb;text-decoration:none} a:hover{text-decoration:underline}
</style>
<h1>📟 VATFix Plus — Your API Key</h1>
<p><b>Key:</b> <code>${key}</code></p>
<p><b>Endpoint:</b> <a href="${endpoint}" target="_blank" rel="noopener">${endpoint}</a></p>
<p><b>Headers:</b></p>
<pre>x-customer-email: ${email}
x-api-key: ${key}</pre>
<p><b>Quick test</b>:</p>
<pre>curl -sS ${endpoint} \
 -H "Content-Type: application/json" \
 -H "x-api-key: ${key}" \
 -H "x-customer-email: ${email}" \
 -d '{"countryCode":"DE","vatNumber":"12345678912"}' | jq .</pre>
<p><a class="btn" href="${portalUrl}" target="_blank" rel="noopener">Manage billing</a></p>
<p class="muted">Keep this safe. It won't be shown again here. An email was also sent to ${email}.</p>
<p class="muted">Need help? <a href="mailto:support@vatfix.eu">support@vatfix.eu</a></p>
<footer style="margin-top:40px;font-size:13px;color:#555">
  © 📟 VATFix Plus — Operated by KIASAT MIDIA, P.IVA IT12741660968<br>
  Largo dei Gelsomini 12, 20146 Milano (MI), Italia<br>
  <a href="/legal">Legal</a> • <a href="mailto:legal@sl.vatfix.eu">legal@sl.vatfix.eu</a>
</footer>`;
}

/* --- Handler --- */
export async function successHandler(req, res) {
  try {
    const sid = req.query.sid;
    if (!sid) return res.status(400).send('Missing sid');

    // 1) Retrieve checkout session
    const sess = await stripe.checkout.sessions.retrieve(String(sid));
    const customerId = sess?.customer;
    if (!customerId) return res.status(404).send('No customer for session');

    // 2) Read entitlement from S3
    const rec = await s3GetJson(`keys/${customerId}.json`).catch(() => null);
    const key = rec?.key;
    const email = rec?.email || sess.customer_details?.email || '';
    if (!key) return res.status(404).send('Key not provisioned yet');

    // 3) Create Billing Portal session
    const portalSess = await stripe.billingPortal.sessions.create({
      customer: String(customerId),
      return_url: `${MARKETING_ORIGIN}/dashboard`,
    });

    // 4) Render
    setSuccessCsp(res);
    const html = renderSuccessHtml({ key, email, portalUrl: portalSess.url });
    return res.status(200).type('html').send(html);
  } catch (e) {
    console.error('[success]', e?.message || e);
    return res.status(500).send('Unable to fetch key');
  }
}

export default successHandler;
