# 📟 VATFix Plus

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

## 🧠 Why Use VATFix Plus?

- ✅ Zero-dashboard, API-only simplicity
- 🔒 Compliance-ready for EU B2B operations
- 🔁 Easy ERP and finance tool integration
- 🧑‍💻 Built by VAT automation pros
- 📧 Human support: [support@vatfix.eu](mailto:support@vatfix.eu)
- 🔗 Manage billing: [Stripe Portal](https://billing.stripe.com/p/login/14A14o2Kk69F6Ei2hQ5wl00)

---

## 💼 Use Cases

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

## 💬 Tell the Feed

**Stop clicking. Start verifying.**

📍 [https://plus.vatfix.eu/plus](https://plus.vatfix.eu/plus)

---

## 📮 Contact
- Email: [support@vatfix.eu](mailto:support@vatfix.eu)

---

**Stay boring. Stay online. Pay your VAT.**
