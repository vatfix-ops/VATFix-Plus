# 📟 VATFix Plus — EU VAT Validation (VIES Fallback)

[![License](https://img.shields.io/github/license/vatfix-plus/vatfix-plus)](./LICENSE.txt)
[![Postman](https://img.shields.io/badge/Open_in-Postman-orange?logo=postman)](https://www.postman.com/vatfixplus/vatfix-plus-eu-vat-validation-vies-fallback)
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
- [Run collection](https://www.postman.com/vatfixplus/vatfix-plus-eu-vat-validation-vies-fallback)
- Environment file: `vatfix.environment.json`

### Zapier
Featured templates:
- [Log new PayPal payments with EU VAT numbers validated by VATFix into BigQuery](https://zapier.com/apps/google-bigquery/integrations/paypal/255665523/log-new-paypal-payments-with-eu-vat-numbers-validated-by-vatfix-into-bigquery)
- [Validate new SurveyMonkey responses with VATFix and create ClickUp tasks](https://zapier.com/apps/clickup/integrations/surveymonkey/255665526/validate-new-surveymonkey-responses-with-vatfix-and-create-clickup-tasks)
- [Create Notion database items from new Shopify customers validated by VATFix Plus](https://zapier.com/apps/notion/integrations/shopify/255665470/create-notion-database-items-from-new-shopify-customers-validated-by-vatfix-plus)
- [Log new WooCommerce customers with validated VATFix numbers as Airtable records](https://zapier.com/apps/airtable/integrations/woocommerce/255665458/log-new-woocommerce-customers-with-validated-vatfix-numbers-as-airtable-records)
- [Add VAT numbers validated by VATFix for new signed DocuSign agreements as SharePoint list items](https://zapier.com/apps/docusign/integrations/sharepoint/255665530/add-vat-numbers-validated-by-vatfix-for-new-signed-docusign-agreements-as-sharepoint-list-items)

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
