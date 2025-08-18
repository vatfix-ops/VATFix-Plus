# 📟 VATFix Plus

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg) ![Status](https://img.shields.io/badge/status-production--ready-brightgreen.svg) ![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)

> A clean, zero-noise VAT number verification API built for compliance-first teams. Lightning fast. Built for engineers, CFOs, and automation addicts.

---

## ⚡ Quickstart

```bash
POST https://plus.vatfix.eu/vat/lookup
```

### Required Headers
```bash
-H "x-api-key: <your key>"
-H "x-customer-email: <billing email>"
```

### JSON Request Body
```json
{
  "countryCode": "DE",
  "vatNumber": "12345678912"
}
```

### Example Response
```json
{
  "valid": true,
  "name": "ACME GmbH",
  "address": "Berlin, Germany",
  "timestamp": "2025-08-17T22:00:00Z"
}
```

### cURL
```bash
curl -sS https://plus.vatfix.eu/vat/lookup \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_key_here" \
  -H "x-customer-email: vault@vatfix.eu" \
  -d '{"countryCode":"DE","vatNumber":"12345678912"}' | jq .
```

---

## 🛠 Installation / Auth Setup

```bash
export VATFIX_KEY=your_api_key
```

Use this environment variable in your requests to simplify authentication.

---

## 💻 SDK / Client Examples

### Node.js
```js
import fetch from "node-fetch";

const res = await fetch("https://plus.vatfix.eu/vat/lookup", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.VATFIX_KEY,
    "x-customer-email": "billing@example.com"
  },
  body: JSON.stringify({ countryCode: "DE", vatNumber: "12345678912" })
});

console.log(await res.json());
```

### Python
```python
import requests

url = "https://plus.vatfix.eu/vat/lookup"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "your_api_key",
    "x-customer-email": "billing@example.com"
}

data = {"countryCode": "DE", "vatNumber": "12345678912"}
response = requests.post(url, headers=headers, json=data)
print(response.json())
```

---

## 🧼 Errors

| Code | Meaning |
|------|---------|
| 401  | `invalid_key`, `missing_api_key`, `missing_customer_email` |
| 403  | `access_denied`, `key_revoked`, `plan_not_allowed` |
| 429  | `rate_limit_exceeded` |

---

## 🔒 Rate Limits
- 120 requests/min per key

Need more? Reach out.

---

## 📊 Monitoring & Reliability
- 🔁 Auto-retry on VIES downtime (30–60s backoff)
- 📦 Cached responses for resilience
- 🚀 SLA: 99.9% uptime

---

## 🧠 Why Use VATFix Plus?

- ✅ Zero-dashboard, API-only simplicity
- 🔒 Compliance-ready for EU B2B operations
- 🔁 Easy ERP and finance tool integration
- 🧑‍💻 Built by VAT automation pros
- 📧 Human support: [support@vatfix.eu](mailto:support@vatfix.eu)
- 🔗 Manage billing: [Stripe Portal](https://checkout.stripe.com/c/pay/cs_live_b1Uvt8MlsKaJU4k8JWI62shf9BhjuRfhhKOL7VsDydundvAI5jMKWqNxph#fidkdWxOYHwnPyd1blppbHNgWjA0V3VXUktJfWlBdWZhNFc0U2hodklCcUZoTXdUQ2prMTxgUHYydlR9aldHQ3BHbmFnV2xEbTR%2FV0NwbnBIRmA0NW9BcnBBSXxDc2JEZjJrQzxGcm5AQlxUNTVoNDJycTB1YicpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl)

---

## 📼 Use Cases

- E-commerce compliance automation
- B2B invoice & partner validation
- ERP and internal tool integrations
- Fraud protection before invoicing

---

## 📦 Plans

| Plan        | Price   | Requests/min | Notes                  |
|-------------|---------|--------------|-------------------------|
| FREE        | €0      | 5/min        | 3-day trial             |
| PLUS        | €99/mo  | 120/min      | Best for scale users    |
| ENTERPRISE  | Custom  | Custom       | Contact us              |

---

## 🏁 Status
- ✅ Actively maintained & monitored
- 🚀 Production-grade

---

## 📚 Docs

For more details, visit: [vatfix.eu/docs](https://vatfix.eu/docs)

---

## 💬 Tell the Feed

**Stop clicking. Start verifying.**

📍 [https://plus.vatfix.eu/plus](https://plus.vatfix.eu/plus)

---

## 📮 Contact
- Email: [support@vatfix.eu](mailto:support@vatfix.eu)

---

**Stay boring. Stay online. Pay your VAT.**
