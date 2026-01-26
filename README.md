# VATFix-Plus

Commercial Service

VATFix-Plus is a paid VAT validation API service.
It does not emit legal authority.
It consumes VATFIX decision artifacts where applicable.

---

## Quickstart

**Endpoint:**
```
POST https://plus.vatfix.eu/vat/lookup
```

**Required headers:**
```
x-api-key
x-customer-email
```

**Example request:**
```bash
curl -sS https://plus.vatfix.eu/vat/lookup \
 -H "Content-Type: application/json" \
 -H "x-api-key: <your key>" \
 -H "x-customer-email: <billing email>" \
 -d '{"countryCode":"DE","vatNumber":"12345678901"}' | jq .
```

[Get your API key](https://plus.vatfix.eu)

---

## Pricing

- **Starter** — €29/mo (10k requests)
- **Growth** — €79/mo (50k requests)
- **Scale** — €199/mo (250k requests)

[Manage subscription](https://billing.stripe.com/p/login/14A14o2Kk69F6Ei2hQ5wI00)

---

## Features

- VIES fallback validation
- Stripe-secured billing
- API key management
- Request quotas
- Audit logs

---

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability reporting.

---

## License

[MIT](./LICENSE.txt)
