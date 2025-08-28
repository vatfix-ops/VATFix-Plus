# 📘 VATFix Plus — Internal Instructions

Private engineering + ops guide. Do **not** ship with customer-facing code or docs.

---

## 🧱 Stack Overview

* **Runtime**: Node.js (ESM)
* **Server**: Express
* **Infra**: Fly.io (global edge)
* **Storage**: AWS S3 (cache + logs)
* **Billing**: Stripe (Checkout + Subscriptions)
* **Email**: ProtonMail / SimpleLogin SMTP aliases

---

## 🚀 Deployment Steps

### 1. Clone Repo

```bash
git clone https://github.com/vatfix/vatfix-plus
cd vatfix-plus
```

### 2. Prepare Secrets

Use Fly secrets or `.env` for local:

```bash
echo STRIPE_SECRET_KEY=sk_live_xxx >> .env
echo STRIPE_WEBHOOK_SECRET=whsec_xxx >> .env
echo AWS_ACCESS_KEY_ID=xxx >> .env
echo AWS_SECRET_ACCESS_KEY=xxx >> .env
echo S3_BUCKET=vatfix-plus >> .env
```

### 3. Local Run

```bash
npm install
node server.mjs
```

### 4. Deploy to Fly.io

```bash
fly launch
fly deploy
```

---

## 📬 Stripe Webhooks

* Endpoint: `POST https://plus.vatfix.eu/webhook`
* Secret: `STRIPE_WEBHOOK_SECRET`

**Flow:**

* `checkout.session.completed` → provision key in S3 (`keys/{customerId}.json`)
* `invoice.paid` → extend quota
* `customer.subscription.deleted` → revoke key

---

## 🔐 S3 Logging & Keys

* **Keys**: `s3://vatfix-plus/keys/{customerId}.json`
* **Logs**: `s3://vatfix-plus/logs/{lookupId}.json`

IAM policy must allow `s3:GetObject` + `s3:PutObject`.

---

## 📈 API Usage Flow

Every request:

1. `entitlement.js` → assert key & plan
2. `meter.js` → enforce per-key rate limit
3. `validate.js` → perform VAT check (VIES → fallback → cache)
4. Log result to S3
5. Return with `X-Rate-Remaining`

---

## 📡 Stripe Setup

Create products + prices in Stripe Dashboard. Example:

* `VATFix Plus` → `price_12345`

Then set in env:

```env
VATFIX_PRICE_IDS=price_12345
```

---

## 📤 SMTP Setup

For password resets / alerts.

```env
MAIL_FROM=alerts@vatfix.eu
SMTP_USER=alerts@vatfix.eu
SMTP_PASS=xxxxxx
SMTP_HOST=smtp.simplelogin.io
SMTP_PORT=587
```

---

## 🧪 Test URLs

* VAT Lookup: `https://plus.vatfix.eu/vat/lookup`
* Key Reset: `https://plus.vatfix.eu/reset`
* Test Issue: `https://plus.vatfix.eu/test/issue`
* Status: `https://plus.vatfix.eu/status.json`
* Docs: `https://plus.vatfix.eu/plus`

---

## ✅ Pre-Release Checklist

* [ ] `fly deploy` works, app responds 200 OK
* [ ] Stripe webhook returns 200 OK
* [ ] Test key issue + reset work with issuer secret
* [ ] S3 logs written on lookup
* [ ] Rate limits enforced per key
* [ ] No secrets or `.env` in repo

---

Stay boring. Stay profitable. 🚀
