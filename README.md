# 📟 VATFix Plus — EU VAT Validation (VIES Fallback)

[![License](https://img.shields.io/github/license/vatfix-plus/vatfix-plus)](./LICENSE.txt)
[![Postman](https://img.shields.io/badge/Open_in-Postman-orange?logo=postman)](https://god.gpt/postman-link)
[![Zapier](https://img.shields.io/badge/Zapier-Templates-blue?logo=zapier)](https://zapier.com/apps/vatfix-plus/integrations)
[![Product Hunt](https://img.shields.io/badge/Product_Hunt-Follow-red?logo=producthunt)](https://www.producthunt.com/products/vatfix-plus)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

---

## 🚀 Overview

**📟 VATFix Plus** is a fallback **EU VAT validation API** designed for reliability when VIES is down. Built for **Stripe-first** businesses, it ensures continuous EU VAT compliance with:

- ✅ **99.9% uptime**
- ✅ **12h caching**
- ✅ **Stripe billing integration**
- ✅ **Instant JSON responses**
- ✅ **Audit logs in S3**
- ✅ **Resettable API keys**

---

## 🔑 Quickstart

### Endpoint
```
POST https://plus.vatfix.eu/vat/lookup
```

### Required headers
```
x-api-key
x-customer-email
```

### Example request
```bash
curl -sS https://plus.vatfix.eu/vat/lookup \
 -H "Content-Type: application/json" \
 -H "x-api-key: <your key>" \
 -H "x-customer-email: <billing email>" \
 -d '{"countryCode":"DE","vatNumber":"12345678901"}' | jq .
```

👉 [Get your API key](https://plus.vatfix.eu/buy)

---

## 🧩 Integrations

### Postman
- [Run collection](https://god.gpt/postman-link)
- Environment file: `vatfix.environment.json`

### Zapier
Featured templates:
- [Validate new Stripe invoices with VATFix Plus](https://zapier.com/apps/vatfix-plus/integrations/stripe#featured)
- [Validate new Stripe subscriptions with VATFix Plus](https://zapier.com/apps/vatfix-plus/integrations/stripe#subs)
- [Validate new Stripe payments with VATFix Plus](https://zapier.com/apps/vatfix-plus/integrations/stripe#payments)
- [Add new Stripe customers → validate VAT → Google Sheets](https://zapier.com/apps/vatfix-plus/integrations/google-sheets)
- [Send Slack alerts for companies validated by VATFix](https://zapier.com/apps/vatfix-plus/integrations/slack)

### Product Hunt
[![Follow on Product Hunt](https://api.producthunt.com/widgets/embed-image/v1/follow.svg?product_id=1098547&theme=light)](https://www.producthunt.com/products/vatfix-plus)

---

## 💳 Billing
- Starter — €29/mo (10k requests)
- Growth — €79/mo (50k requests)
- Scale — €199/mo (250k requests)

👉 [Manage subscription](https://billing.stripe.com/p/login/14A14o2Kk69F6Ei2hQ5wI00)

---

## 🛡️ Security
- See [SECURITY.md](./SECURITY.md) for vulnerability reporting.
- Private reports enabled on GitHub.
- Keys are stored in AWS S3, rotated via `/reset`.

---

## 🤝 Contributing
We welcome PRs and issues.

1. Fork this repo
2. Copy `.env.example` → `.env`
3. `npm install`
4. `npm run dev`
5. Run tests with `npm test`

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 📜 License
[MIT](./LICENSE.txt)

---

## 📬 Support
- Docs: [plus.vatfix.eu/plus](https://plus.vatfix.eu/plus)
- Email: [support@vatfix.eu](mailto:support@vatfix.eu)
