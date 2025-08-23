# 📟 VATFix Plus — EU VAT Validation (VIES Fallback)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg) ![Status](https://img.shields.io/badge/status-production--ready-brightgreen.svg) ![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)

[<img src="https://run.pstmn.io/button.svg" alt="Run In Postman" style="width: 128px; height: 32px;">](https://god.gw.postman.com/run-collection/47801394-751f47bb-ee62-475d-a90a-30967b065c12?action=collection%2Ffork&source=rip_markdown&collection-url=entityId%3D47801394-751f47bb-ee62-475d-a90a-30967b065c12%26entityType%3Dcollection%26workspaceId%3D624016be-ec36-4aa8-85ef-c690efa272bb#?env%5BVATFix%20Plus%20(env)%5D=W3sia2V5IjoiYXBpS2V5IiwidmFsdWUiOiIiLCJ0eXBlIjoiZGVmYXVsdCIsImVuYWJsZWQiOnRydWV9LHsia2V5IjoiY3VzdG9tZXJFbWFpbCIsInZhbHVlIjoiIiwidHlwZSI6ImRlZmF1bHQiLCJlbmFibGVkIjp0cnVlfV0=)

A clean, zero‑noise VAT number verification API built for compliance‑first teams. Lightning fast. Built for engineers, CFOs, and automation addicts.

---

## ⚡ Quickstart

**Endpoint**

```
POST https://plus.vatfix.eu/vat/lookup
```

**Required Headers**

```
x-api-key: <your key>
x-customer-email: <billing email>
Content-Type: application/json
```

**Request Body**

```json
{
  "countryCode": "DE",
  "vatNumber": "12345678912"
}
```

**Successful (live VIES) Response**

```json
{
  "countryCode": "DE",
  "vatNumber": "12345678912",
  "valid": true,
  "name": "ACME GmbH",
  "address": "Berlin, Germany",
  "requestDate": "2025-08-17T22:00:00Z",
  "source": "vies",
  "lookupId": "DE-12345678912-xyz123"
}
```

**Successful (cached) Response**

```json
{
  "countryCode": "IT",
  "vatNumber": "12345678901",
  "valid": true,
  "name": "ACME S.p.A.",
  "address": "Via Esempio 1, 20100 Milano, IT",
  "requestDate": "2025-08-21T18:14:06Z",
  "source": "cache",
  "lookupId": "IT-12345678901-abc123",
  "cacheTtlMs": 43200000
}
```

**cURL**

```bash
curl -sS https://plus.vatfix.eu/vat/lookup \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-customer-email: billing@example.com" \
  -d '{"countryCode":"DE","vatNumber":"12345678912"}' | jq .
```

---

## 💻 Client Examples

### Node.js (fetch)

```js
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

### Python (requests)

```python
import requests

url = "https://plus.vatfix.eu/vat/lookup"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "YOUR_API_KEY",
    "x-customer-email": "billing@example.com"
}
data = {"countryCode": "DE", "vatNumber": "12345678912"}
print(requests.post(url, headers=headers, json=data).json())
```

---

## 🧼 Errors

| HTTP | Codes                                                          | When                                      |
| ---: | -------------------------------------------------------------- | ----------------------------------------- |
|  400 | `missing_vat_data`                                             | Body missing `countryCode` or `vatNumber` |
|  401 | `invalid_api_key`, `missing_api_key`, `missing_customer_email` | Auth issues                               |
|  403 | `access_denied`, `key_revoked`, `plan_not_allowed`             | Not entitled / wrong plan                 |
|  429 | `rate_limit_exceeded`                                          | Per‑key rate limit exceeded               |
|  500 | `server_error`                                                 | Unexpected error                          |

**Header:** `X-Rate-Remaining` is returned when available.

---

## 🔒 Rate Limits & Fair Use

* Default **120 requests/min** per key.
* Burst responsibly; contact support for higher RPS/SLA.

---

## 📊 Reliability

* Automatic fallback to **cached** entries during VIES downtime
* S3 cache with TTL
* Production SLA **99.9%**

**Status probe:** `GET https://plus.vatfix.eu/status.json` → `{ "status": "ok", "region": "eu-north-1", "host": "fly" }`

---

## 🧠 Notes & Best Practices

* **Privacy:** Do **not** put real company PII in examples/logs. Use placeholders like “ACME GmbH”.
* **Validation:** Send VAT numbers **without spaces or punctuation**.
* **Idempotency:** Same VAT within TTL may return cached response (`source: "cache"`).

---

## 📮 Support

* Email: **[support@vatfix.eu](mailto:support@vatfix.eu)**
* Billing Portal: available on your success page or portal link in emails

---

## 🔗 Links

* Product page: [https://puls.vatfix.eu/plus](https://puls.vatfix.eu/plus)
* Terms & Privacy: [https://vatfix.eu/legal](https://vatfix.eu/legal)
