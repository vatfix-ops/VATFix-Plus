// server.mjs — 📟 VATFix Plus (with secure test key issuer)
// Hosts docs, pricing, checkout, success page, webhook, /vat/* API, /reset, /homepage
// Adds /test/issue for integration reviewers (Zapier, etc.) with issuer-only auth.

import crypto from 'crypto';
import express from 'express';
import Stripe from 'stripe';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// Internal libs (kept under /lib)
import checkVAT from './lib/validate.js';
import { meterAndCheck } from './lib/meter.js';
import { assertActivePlus } from './lib/entitlement.js';
import webhookHandler, { emailKey } from './webhook.js';

const h = String.raw;

// --- Env ---
const {
  STRIPE_SECRET_KEY,
  S3_BUCKET,
  AWS_REGION = 'eu-north-1',

  MARKETING_ORIGIN = 'https://plus.vatfix.eu',

  CHECKOUT_PRICE_ID,                 // fallback price if lookup_keys not present
  CHECKOUT_SUCCESS_PATH = '/success',
  CHECKOUT_CANCEL_PATH = '/cancel',

  TRIAL_DAYS = '',                   // optional free trial days

  // 🔐 Issuer for integration/reviewer keys
  TEST_ISSUER_SECRET = '',           // required to call /test/issue and rotate integration keys
  ZAPIER_TEST_EMAIL = 'integration-testing@zapier.com',
} = process.env;

if (!STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY');
if (!S3_BUCKET) throw new Error('Missing S3_BUCKET');

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
const s3 = new S3Client({ region: AWS_REGION });

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');

// ---------- Stripe webhook MUST see raw body (FIRST) ----------
app.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);

// ---------- Global security headers ----------
app.use((req, res, next) => {
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  if (!req.path.startsWith('/success')) {
    res.set('Cache-Control', 'no-cache');
  }
  next();
});

// ---------- JSON for everything else ----------
app.use(express.json({ limit: '1mb' }));

// ---------- Shared constants ----------
const endpoint = 'https://plus.vatfix.eu/vat/lookup';
const portal = 'https://billing.stripe.com/p/login/14A14o2Kk69F6Ei2hQ5wI00';

// ---------- Tiny S3 JSON helpers (safe) ----------
async function s3GetJson(Key) {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key }));
    const body = out.Body;
    const buf = typeof body?.transformToByteArray === 'function'
      ? Buffer.from(await body.transformToByteArray())
      : await new Promise((resolve, reject) => {
          const chunks = [];
          body.on('data', (c) => chunks.push(c));
          body.on('end', () => resolve(Buffer.concat(chunks)));
          body.on('error', reject);
        });
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}
async function s3PutJson(Key, data) {
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  }));
}

// ---------- Footer ----------
function renderFooter() {
  return h`<footer style="margin-top:40px;font-size:13px;color:#555">
  © 📟 VATFix Plus — Operated by KIASAT MIDIA, P.IVA IT12741660968<br>
  Largo dei Gelsomini 12, 20146 Milano (MI), Italia<br>
  <a href="/legal">Legal</a> • <a href="mailto:legal@sl.vatfix.eu">legal@sl.vatfix.eu</a>
</footer>`;
}

// ---------- Renderers ----------
function renderPlusPage() {
  return h`<!doctype html><meta charset="utf-8">
<title>📟 VATFix Plus — Quickstart</title>
<style>
  body{font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px;max-width:820px}
  code,pre{font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  pre{background:#0b1021;color:#e5e7eb;padding:14px;border-radius:12px;overflow:auto}
  .pill{display:inline-block;background:#eef;padding:2px 8px;border-radius:999px;font-size:12px}
  a{color:#2563eb;text-decoration:none} a:hover{text-decoration:underline}
  .btn{display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none}
</style>
<h1>📟 VATFix Plus — Quickstart</h1>
<p><span class="pill">Endpoint</span><br><code>POST ${endpoint}</code></p>
<p><span class="pill">Required headers</span><br><code>x-api-key</code> • <code>x-customer-email</code></p>
<pre>curl -sS ${endpoint} \
 -H "Content-Type: application/json" \
 -H "x-api-key: &lt;your key&gt;" \
 -H "x-customer-email: &lt;billing email&gt;" \
 -d '{"countryCode":"DE","vatNumber":"12345678912"}' | jq .</pre>
<p><a class="btn" href="/buy">Get your API key</a></p>
<p><span class="pill">Reset</span><br>Rotate your key any time with <code>POST /reset</code> (see docs below).</p>
<p><span class="pill">Limits</span><br>Default <code>120</code> requests/min per key.</p>
<p><span class="pill">Errors</span></p>
<pre>401 invalid_key | 401 missing_api_key | 401 missing_customer_email
403 access_denied | 403 key_revoked | 403 plan_not_allowed
429 rate_limit_exceeded</pre>
<p><span class="pill">Billing & support</span><br>
  Manage subscription: <a href="${portal}">${portal}</a><br>
  Email: <a href="mailto:support@vatfix.eu">support@vatfix.eu</a></p>
<p>Stay boring, stay online.</p>
${renderFooter()}`;
}

function renderPricingPage() {
  return h`<!doctype html><meta charset="utf-8">
<title>📟 VATFix Plus — Pricing</title>
<style>
  body{font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px;max-width:900px}
  .card{border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin:12px 0}
  .btn{display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none}
  code{background:#f6f7f9;padding:2px 6px;border-radius:6px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
</style>
<h1>📟 VATFix Plus — Pricing</h1>
<div class="grid">
  <div class="card">
    <h2>Starter</h2>
    <p>€29/mo — 10k requests</p>
    <a class="btn" href="/buy?tier=starter">Buy Starter</a>
  </div>
  <div class="card">
    <h2>Growth</h2>
    <p>€79/mo — 50k requests</p>
    <a class="btn" href="/buy?tier=growth">Buy Growth</a>
  </div>
  <div class="card">
    <h2>Scale</h2>
    <p>€199/mo — 250k requests</p>
    <a class="btn" href="/buy?tier=scale">Buy Scale</a>
  </div>
</div>
<p>Endpoint: <code>${endpoint}</code></p>
${renderFooter()}`;
}

function renderFAQPage() {
  return h`<!doctype html><meta charset="utf-8">
<title>📟 VATFix Plus — FAQ</title>
<style>body{font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px;max-width:820px}</style>
<h1>📟 VATFix Plus — FAQ</h1>
<h3>Which countries?</h3>
<p>All EU member states supported by VIES.</p>
<h3>Headers required?</h3>
<p><code>x-api-key</code> and <code>x-customer-email</code>.</p>
<h3>How does caching work?</h3>
<p>Each VAT number response is cached in S3 for 12 hours. On VIES outage we serve the cached entry and set <code>source: "cache"</code>.</p>
<h3>What are the errors?</h3>
<p>401 <code>invalid_key</code>, 401 <code>missing_* </code>, 403 <code>access_denied</code>, 403 <code>plan_not_allowed</code>, 429 <code>rate_limit_exceeded</code>.</p>
${renderFooter()}`;
}

function renderHomePage() {
  const plans = [
    { name: '📟 VATFix Plus — Starter', price: '€29/mo',  tier: 'starter', blurb: '10k requests / month' },
    { name: '📟 VATFix Plus — Growth',  price: '€79/mo',  tier: 'growth',  blurb: '50k requests / month' },
    { name: '📟 VATFix Plus — Scale',   price: '€199/mo', tier: 'scale',   blurb: '250k requests / month' },
  ];
  const planCards = plans.map(p => h`
    <div class="card">
      <h3 style="margin:0 0 6px 0">${p.name}</h3>
      <div style="font-weight:600;margin-bottom:6px">${p.price}</div>
      <div style="color:#555;margin-bottom:10px">${p.blurb}</div>
      <a class="btn" href="/buy?tier=${p.tier}">Get ${p.name.replace('📟 VATFix Plus — ', '')}</a>
    </div>`).join('');

  return h`<!doctype html><meta charset="utf-8">
<title>📟 VATFix Plus - EU VAT Validation (VIES Fallback)</title>
<style>
  :root{--bg:#0b1021;--fg:#e5e7eb}
  body{font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px;max-width:900px;color:#111}
  code{background:#f6f7f9;padding:2px 6px;border-radius:6px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
  .card{border:1px solid #e5e7eb;border-radius:14px;padding:16px}
  .btn{display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none}
  pre{background:var(--bg);color:var(--fg);padding:14px;border-radius:12px;overflow:auto}
  ul{margin:0 0 10px 20px}
  a{color:#2563eb;text-decoration:none} a:hover{text-decoration:underline}
</style>
<h1>📟 VATFix Plus - EU VAT Validation (VIES Fallback)</h1>
<p>📟 VATFix Plus is a fallback VAT validation API for when VIES goes down. Designed for EU businesses with Stripe-first integration, instant EU VAT checks, and 99.9% uptime. Keep selling even when VIES is offline.</p>

<div class="card">
  <h2>Highlights</h2>
  <ul>
    <li><b>Simple JSON</b> → <code>POST ${endpoint}</code></li>
    <li><b>Fast</b> → TLS keep-alive + 12h cache</li>
    <li><b>Limits</b> → 120 requests/min per key</li>
    <li><b>Compliant</b> → iubenda legal, audit logs in S3</li>
    <li><b>Resettable</b> → rotate your API key anytime at <code>POST /reset</code></li>
  </ul>
</div>

<div class="card">
  <h2>Quick test</h2>
  <pre>curl -sS ${endpoint} \
 -H "Content-Type: application/json" \
 -H "x-api-key: &lt;your key&gt;" \
 -H "x-customer-email: &lt;billing email&gt;" \
 -d '{"countryCode":"DE","vatNumber":"12345678912"}' | jq .</pre>
</div>

<div class="grid">
  ${planCards}
</div>

<div class="card">
  <h2>Reset your key</h2>
  <p>Rotate instantly; old key is revoked and archived.</p>
  <pre>curl -sS -X POST https://plus.vatfix.eu/reset \
 -H "Content-Type: application/json" \
 -H "x-api-key: &lt;current key&gt;" \
 -H "x-customer-email: &lt;billing email&gt;"</pre>
</div>

<div class="card">
  <h2>Docs & Billing</h2>
  <p><a href="/plus">Quickstart</a> • <a href="/faq">FAQ</a> • <a href="/pricing">Pricing</a> • <a href="/legal">Legal</a></p>
  <p>Manage subscription: <a href="${portal}">Stripe Portal</a> • Email: <a href="mailto:support@vatfix.eu">support@vatfix.eu</a></p>
</div>

${renderFooter()}`;
}

function setSuccessCsp(res) {
  res.set('Cache-Control', 'no-store');
  res.set('X-Frame-Options', 'DENY');
  res.set('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'; img-src data: https:; frame-ancestors 'none'");
}

function renderSuccessHtml({ key, email, portalUrl }) {
  return h`<!doctype html><meta charset="utf-8">
<title>📟 VATFix Plus — Your API Key</title>
<style>
  body{font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px;max-width:820px;color:#111}
  code,pre{font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  pre{background:#0b1021;color:#e5e7eb;padding:14px;border-radius:12px;overflow:auto}
  .btn{display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none}
  .muted{color:#555}
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
${renderFooter()}`;
}

// ---------- VAT API ----------
async function vatHandler(req, res) {
  try {
    const apiKey = String(req.header('x-api-key') || '').trim();
    const emailHeader = String(req.header('x-customer-email') || '').trim();
    const { countryCode, vatNumber } = req.body || {};

    if (!apiKey) return res.status(401).json({ error: 'missing_api_key' });
    if (!emailHeader) return res.status(401).json({ error: 'missing_customer_email' });
    if (!countryCode || !vatNumber) return res.status(400).json({ error: 'missing_vat_data' });

    // Integration keys bypass Stripe entitlement (but still rate-limited + logged)
    const rec = await s3GetJson(`keys/by-key/${apiKey}.json`);
    if (rec && rec.active === true && rec.issuer === 'integration') {
      const email = rec.email || emailHeader;
      const meterRes = await meterAndCheck({ apiKey, email, countryCode, vatNumber });
      if (meterRes.remaining !== undefined) res.set('X-Rate-Remaining', String(meterRes.remaining));
      if (!meterRes.allowed) return res.status(429).json({ error: meterRes.reason || 'rate_limit_exceeded' });
      const result = await checkVAT({ countryCode, vatNumber, email });
      return res.status(200).json(result);
    }

    // Normal flow: Entitlement via S3 + Stripe
    try {
      await assertActivePlus({ apiKey, email: emailHeader });
    } catch (e) {
      const code = String(e?.message || '');
      if (code === 'invalid_key') return res.status(401).json({ error: 'invalid_api_key' });
      if (code === 'key_revoked') return res.status(403).json({ error: 'key_revoked' });
      if (code === 'no_active_subscription') return res.status(403).json({ error: 'access_denied' });
      if (code === 'price_not_allowed') return res.status(403).json({ error: 'plan_not_allowed' });
      return res.status(403).json({ error: 'access_denied' });
    }

    // Per-key rate limit (best-effort)
    const meterRes = await meterAndCheck({ apiKey, email: emailHeader, countryCode, vatNumber });
    if (meterRes.remaining !== undefined) res.set('X-Rate-Remaining', String(meterRes.remaining));
    if (!meterRes.allowed) return res.status(429).json({ error: meterRes.reason || 'rate_limit_exceeded' });

    // VIES with S3 cache fallback
    const result = await checkVAT({ countryCode, vatNumber, email: emailHeader });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[vat] server error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
app.post('/vat/validate', vatHandler);
app.post('/vat/lookup',  vatHandler);

// ---------- RESET: Rotate API Key ----------
app.post('/reset', async (req, res) => {
  try {
    const apiKey = String(req.header('x-api-key') || '').trim();
    const email  = String(req.header('x-customer-email') || '').trim();
    const auth   = String(req.header('authorization') || '');

    if (!apiKey) return res.status(401).json({ error: 'missing_api_key' });
    if (!email)  return res.status(401).json({ error: 'missing_customer_email' });

    const rec = await s3GetJson(`keys/by-key/${apiKey}.json`);
    if (!rec || rec.active === false) return res.status(401).json({ error: 'invalid_api_key' });

    // Integration key rotation: require issuer secret
    if (rec.issuer === 'integration') {
      const ok = TEST_ISSUER_SECRET && auth.toLowerCase() === `bearer ${TEST_ISSUER_SECRET}`.toLowerCase();
      if (!ok) return res.status(403).json({ error: 'access_denied' });
    } else {
      // Normal customers: Stripe-gated
      try {
        await assertActivePlus({ apiKey, email });
      } catch (e) {
        const code = String(e?.message || '');
        if (code === 'invalid_key') return res.status(401).json({ error: 'invalid_api_key' });
        if (code === 'key_revoked') return res.status(403).json({ error: 'key_revoked' });
        if (code === 'no_active_subscription') return res.status(403).json({ error: 'access_denied' });
        if (code === 'price_not_allowed') return res.status(403).json({ error: 'plan_not_allowed' });
        return res.status(403).json({ error: 'access_denied' });
      }
      // Optional: enforce email match if present
      if (rec.email && String(rec.email).toLowerCase() !== String(email).toLowerCase()) {
        return res.status(403).json({ error: 'access_denied' });
      }
    }

    const now = new Date().toISOString();
    const newKey = 'sk_live_' + crypto.randomBytes(24).toString('hex');

    // Write updated customer record
    const updated = { ...rec, key: newKey, active: true, rotatedAt: now, updatedAt: now };
    delete updated.deactivatedAt;

    await s3PutJson(`keys/${rec.customerId}.json`, updated);
    await s3PutJson(`keys/by-key/${newKey}.json`, updated);
    await s3PutJson(`keys/by-key/${apiKey}.json`, { ...rec, active: false, revokedAt: now, supersededBy: newKey });

    try { await emailKey(rec.email || email, newKey); } catch {}

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ apiKey: newKey, rotated: true });
  } catch (err) {
    console.error('[reset] error:', err?.message || err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ---------- TEST: Issue integration key (Zapier, etc.) ----------
app.post('/test/issue', async (req, res) => {
  try {
    const auth = String(req.header('authorization') || '');
    const ok = TEST_ISSUER_SECRET && auth.toLowerCase() === `bearer ${TEST_ISSUER_SECRET}`.toLowerCase();
    if (!ok) return res.status(403).json({ error: 'access_denied' });

    const email = String((req.body?.email || ZAPIER_TEST_EMAIL)).trim().toLowerCase();
    const label = String(req.body?.label || 'Zapier Reviewer').trim();
    const plan  = String(req.body?.plan || 'starter').trim(); // metadata only

    const customerId = `test_${crypto.createHash('sha256').update(email + ':' + Date.now()).digest('hex').slice(0,24)}`;
    const apiKey = 'sk_live_' + crypto.randomBytes(24).toString('hex'); // live-like shape
    const now = new Date().toISOString();

    const record = {
      customerId,
      email,
      key: apiKey,
      active: true,
      createdAt: now,
      updatedAt: now,
      issuer: 'integration',
      label,
      plan,
      priceId: null,
      test: true,
    };

    await s3PutJson(`keys/${customerId}.json`, record);
    await s3PutJson(`keys/by-key/${apiKey}.json`, record);

    try { await emailKey(email, apiKey); } catch {}

    return res.status(201).json({
      customerId,
      email,
      apiKey,
      note: 'Integration key issued; include x-customer-email in requests; use /reset with Bearer secret to rotate.',
    });
  } catch (e) {
    console.error('[test/issue]', e?.message || e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ---------- BUY: Stripe Checkout ----------
app.get('/buy', async (req, res) => {
  try {
    const tier = String(req.query.tier || '').toLowerCase(); // starter|growth|scale
    const lookup = tier === 'growth' ? 'growth_monthly'
                 : tier === 'scale'  ? 'scale_monthly'
                 : tier === 'starter'? 'starter_monthly'
                 : null;

    let priceId = CHECKOUT_PRICE_ID;
    if (lookup) {
      const { data } = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
      if (data[0]?.id) priceId = data[0].id;
    }
    if (!priceId) return res.status(503).send('Price not configured');

    const successUrl = `${MARKETING_ORIGIN}${CHECKOUT_SUCCESS_PATH}?sid={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${MARKETING_ORIGIN}${CHECKOUT_CANCEL_PATH}`;
    const trialDays  = String(TRIAL_DAYS || '').trim();
    const subscription_data = trialDays ? { trial_period_days: Number(trialDays) } : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
      subscription_data,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return res.redirect(303, session.url);
  } catch (e) {
    console.error('[buy]', e?.message || e);
    return res.status(500).send('Unable to start checkout');
  }
});

// ---------- Legal aggregate ----------
app.get('/legal', (_req, res) => {
  res.type('html').send(h`<!doctype html><meta charset="utf-8">
<title>📟 VATFix Plus — Legal</title>
<style>body{font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px;max-width:820px}</style>
<h1>📟 VATFix Plus — Legal</h1>
<ul>
  <li><a href="https://www.iubenda.com/privacy-policy/41345819" target="_blank">Privacy Policy</a></li>
  <li><a href="https://www.iubenda.com/privacy-policy/41345819/cookie-policy" target="_blank">Cookie Policy</a></li>
  <li><a href="https://www.iubenda.com/terms-and-conditions/41345819" target="_blank">Terms & Conditions</a></li>
</ul>
<p>Contact: <a href="mailto:support@vatfix.eu">support@vatfix.eu</a></p>
${renderFooter()}`);
});
app.get('/vat/legal', (_req, res) => res.redirect(301, '/legal'));

// ---------- Success page ----------
async function successHandler(req, res) {
  try {
    const sid = req.query.sid;
    if (!sid) return res.status(400).send('Missing sid');

    const sess = await stripe.checkout.sessions.retrieve(String(sid));
    const customerId = sess?.customer;
    if (!customerId) return res.status(404).send('No customer for session');

    const rec = await s3GetJson(`keys/${customerId}.json`);
    const key = rec?.key;
    const email = rec?.email || sess.customer_details?.email || '';

    if (!key) return res.status(404).send('Key not provisioned yet');

    const portalSess = await stripe.billingPortal.sessions.create({
      customer: String(customerId),
      return_url: `${MARKETING_ORIGIN}/dashboard`,
    });

    setSuccessCsp(res);
    const html = renderSuccessHtml({ key, email, portalUrl: portalSess.url });
    return res.status(200).type('html').send(html);
  } catch (e) {
    console.error('[success]', e?.message || e);
    return res.status(500).send('Unable to fetch key');
  }
}
app.get('/success', successHandler);
app.get('/vat/success', successHandler);

// ---------- Docs & pages ----------
app.get('/plus', (_req, res) => res.type('html').send(renderPlusPage()));
app.get('/vat/plus', (_req, res) => res.type('html').send(renderPlusPage()));

app.get('/pricing', (_req, res) => res.type('html').send(renderPricingPage()));
app.get('/vat/pricing', (_req, res) => res.type('html').send(renderPricingPage()));

app.get('/faq', (_req, res) => res.type('html').send(renderFAQPage()));
app.get('/vat/faq', (_req, res) => res.type('html').send(renderFAQPage()));

app.get('/homepage', (_req, res) => res.type('html').send(renderHomePage()));
app.get('/home', (_req, res) => res.type('html').send(renderHomePage()));
app.get('/plans', (_req, res) => res.type('html').send(renderHomePage()));
app.get('/vat/homepage', (_req, res) => res.type('html').send(renderHomePage()));

// ---------- Status ----------
app.get('/status', (_req, res) => {
  const started = process.env.FLY_MACHINE_ID ? 'fly' : 'local';
  res.type('html').send(h`<!doctype html><meta charset="utf-8">
<title>📟 VATFix Plus — Status</title>
<style>body{font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px;max-width:820px}.ok{color:#16a34a}.muted{color:#6b7280}</style>
<h1 class="ok">● All systems green</h1>
<p class="muted">Region: ${AWS_REGION} • Host: ${started}</p>
${renderFooter()}`);
});
app.get('/vat/status', (_req, res) => res.redirect(301, '/status'));
app.get('/status.json', (_req, res) => {
  res.json({ status: 'ok', region: AWS_REGION, host: process.env.FLY_MACHINE_ID ? 'fly' : 'local' });
});
app.get('/vat/status.json', (_req, res) => res.redirect(301, '/status.json'));

// ---------- robots.txt ----------
const robotsTxt = 'User-agent: *\nAllow: /\n';
app.get('/robots.txt', (_req, res) => res.type('text/plain').send(robotsTxt));
app.get('/vat/robots.txt', (_req, res) => res.redirect(301, '/robots.txt'));

// ---------- Minimal policy stubs ----------
app.get('/legal/privacy', (_req, res) => {
  res.type('html').send(h`<!doctype html><meta charset="utf-8"><title>📟 VATFix Plus — Privacy</title>
<style>body{font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px;max-width:820px}</style>
<h1>📟 VATFix Plus — Privacy</h1>
<p>We store minimal logs in S3 for audit and abuse control. No personal data beyond billing email and VAT numbers sent to the API.</p>
${renderFooter()}`);
});
app.get('/vat/legal/privacy', (_req, res) => res.redirect(301, '/legal/privacy'));

app.get('/legal/terms', (_req, res) => {
  res.type('html').send(h`<!doctype html><meta charset="utf-8"><title>📟 VATFix Plus — Terms</title>
<style>body{font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:40px;max-width:820px}</style>
<h1>📟 VATFix Plus — Terms</h1>
<p>Service is provided as-is with best-effort uptime. Fair use applies. Contact support for custom SLA.</p>
${renderFooter()}`);
});
app.get('/vat/legal/terms', (_req, res) => res.redirect(301, '/legal/terms'));

// ---------- Health + misc ----------
app.get('/', (_req, res) => res.type('html').send(renderHomePage()));
app.get('/vat', (_req, res) => res.type('html').send(renderPlusPage()));
app.get('/cancel', (_req, res) => res.status(200).send('Checkout canceled.'));
app.get('/vat/cancel', (_req, res) => res.redirect(301, '/cancel'));

// ---------- 404 ----------
app.use((_req, res) => res.status(404).send('Not found'));

// --- Start ---
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  const stripeOn = STRIPE_SECRET_KEY ? 'on' : 'off';
  const s3On = S3_BUCKET ? 'on' : 'off';
  const testOn = TEST_ISSUER_SECRET ? 'on' : 'off';
  console.log(`🚀 VATFix-Plus listening on 0.0.0.0:${port} (stripe=${stripeOn}, s3=${s3On}, test_issuer=${testOn})`);
});
