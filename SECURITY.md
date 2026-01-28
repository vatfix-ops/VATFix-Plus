# Security Policy — VATFix Plus

Thanks for helping keep VATFix Plus and our users safe. This document explains how to report vulnerabilities, what is in scope, and how we work with security researchers.

---

## 📫 Reporting a Vulnerability

* **Email:** [security@vatfix.eu](mailto:security@vatfix.eu) (or [support@vatfix.eu](mailto:support@vatfix.eu))
* **Subject line:** `Vulnerability Report: <short summary>`
* **Include:**

  * A clear description of the issue and the affected component/URL.
  * Reproduction steps or a minimal PoC (curl/HTTP transcript is great).
  * Expected vs. observed behavior.
  * Any relevant request/response headers (sanitize secrets).
  * Impact assessment and suggested remediation (if known).
* **Please avoid sending credentials or personal data.** If you must share sensitive details, ask us for a temporary encryption key and channel.

We will acknowledge your report **within 72 hours**, provide an initial assessment within **7 days**, and keep you updated as we work on a fix.

We do not operate a monetary bounty program at this time. In good‑faith cases, we’re happy to provide **public thanks** (Hall of Fame) and, where appropriate, **free credits** for testing.

---

## 🔒 Safe Harbor & Good‑Faith Guidelines

We support responsible research and coordinated disclosure. If you follow the rules below, we will not initiate legal action or law‑enforcement investigation against you:

**Do:**

* Act in **good faith** and stop testing immediately upon discovering sensitive data.
* **Limit the scope** of your testing to what’s permitted (below).
* **Respect rate limits**; keep traffic low and non‑disruptive (suggested: ≤ 5 requests/second, ≤ 500 total/day).
* Use **test data** (see examples) and your own accounts.
* Give us **reasonable time** to remediate before public disclosure.

**Do not:**

* Exfiltrate, modify, or delete data.
* Perform **DoS/DDoS**, load testing, or traffic flooding.
* Attempt to access other customers’ accounts or payment data.
* Use automated scanners that can generate excessive noise or trigger third‑party abuse controls.
* Social‑engineer, phish, or attack our staff, vendors, or users.
* Publish exploit code or details before we confirm a fix or an agreed disclosure date.

---

## 🎯 Scope

**In scope** (production and staging where applicable):

* The VATFix Plus code in this repository.
* Public endpoints hosted at `https://plus.vatfix.eu/`:

  * `POST /vat/lookup` and `POST /vat/validate`
  * `POST /reset`
  * `GET /plus`, `/pricing`, `/faq`, `/homepage`, `/status(.json)`, `/legal/*`
  * Static assets we serve under the same domain.
* Our webhook handler logic (source available in `webhook.js`).

**Out of scope** (report to the vendor/service owner instead):

* **Stripe** platform, billing portal, and Checkout pages.
* **AWS** infrastructure and the S3 service itself.
* **Zapier**, **Postman**, **Product Hunt**, or any third‑party marketplaces.
* EU **VIES** service availability/behavior (no uptime guarantees).
* Denial‑of‑service, volumetric issues, and best‑practice advisories without a concrete exploit.

If you’re unsure whether a target is in scope, email us first.

---

## 🧪 Testing Notes (API)

**Required headers:**

* `x-api-key: <your test key>`
* `x-customer-email: you@example.com`
* `Content-Type: application/json`

**Example request (test data):**

```bash
curl -sS https://plus.vatfix.eu/vat/lookup \
  -H "Content-Type: application/json" \
  -H "x-api-key: <redacted>" \
  -H "x-customer-email: you@example.com" \
  -d '{"countryCode":"DE","vatNumber":"12345678912"}'
```

> Use sample VAT numbers or clearly non‑sensitive data. Do not probe real customer identifiers without explicit permission.

**Webhooks:** Please **do not brute‑force** or guess Stripe webhook secrets. To test webhook behavior, set up a Stripe test mode endpoint to your own instance or request temporary guidance from us.

---

## ✅ Vulnerability Classes We Care About

* Authentication/authorization flaws (IDOR, privilege escalation).
* Leakage of secrets, keys, or configuration through responses, logs, or headers.
* Request smuggling, SSRF, path traversal, template/code injection.
* Insecure deserialization, command injection, prototype pollution.
* XSS/CSRF affecting our pages or any authenticated flows.
* Logic flaws in key rotation (`POST /reset`) and entitlement checks.
* Broken or missing TLS/security headers.

**Generally out of scope:**

* Missing SPF/DMARC/`X-Powered-By` banners, lack of rate‑limit headers alone.
* Weak password policy suggestions (accounts use federated auth).
* Clickjacking on pages without sensitive actions.
* Vulnerabilities requiring a compromised device or non‑supported browser.

---

## 🔁 Coordinated Disclosure Timeline

1. **Report received** → We acknowledge within **72 hours**.
2. **Triage** → Initial assessment and severity in **≤ 7 days**.
3. **Fix window** → Typically **30 days** for High/Critical, **90 days** for Medium/Low. We’ll negotiate if risk is higher/lower or a dependency is involved.
4. **Credit** → With your consent, we add you to our **Hall of Fame** and release notes.

If a finding impacts a third party (e.g., Stripe/AWS), we’ll coordinate with the vendor and keep you updated.

---

## 🔐 Secrets & Keys

* Never commit real secrets to the repository. Use environment variables only (e.g., `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `S3_BUCKET`, `AWS_REGION`).
* Keys emailed to customers are single‑purpose API keys, not Stripe or AWS credentials.
* If you believe you’ve found a leaked key, **email us immediately**. We can rotate via `/reset` and revoke in S3.

---

## 🧩 Supply Chain & Dependencies

* Runtime: Node.js / Express.
* Payments & billing: Stripe (Checkout/Webhooks).
* Storage: AWS S3 (key records, event idempotency, audit JSON).
* We use `npm audit` and Dependabot/GitHub Advisory Database for dependency alerts.

You’re encouraged to report vulnerable transitive dependencies with a working exploit path.

---

## 🛡️ Platform Hardening (at a glance)

* TLS enforced; HSTS and `X-Content-Type-Options` headers set.
* Minimal attack surface; JSON APIs only.
* Per‑key rate limiting (best‑effort) and S3‑backed idempotency for webhooks.
* Principle of least privilege on S3 buckets.
* Rotatable customer keys via `/reset` and email notifications on rotation/issuance.

---

## 🗓️ Supported Versions

We support the latest deploy on `plus.vatfix.eu`. Security fixes are shipped continuously; older images are not maintained.

---

## 🙏 Thanks

We appreciate your time and care. Responsible research makes the internet safer. If we can attribute public credit for your finding, let us know the **name/link** you’d like us to use.

— VATFix Plus Team
