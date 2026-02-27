---
title: Invoice Example
description: Generate a professional invoice PDF from markdown.
llm_summary: |
  Example showing how to generate an invoice using headings, tables, bold text,
  and horizontal rules. Uses table option for custom styling.
---

# Invoice Example

Generate a clean invoice using tables, headings, and bold text.

## Markdown Content

```markdown
# INVOICE

**Invoice #:** INV-2024-0042
**Date:** February 27, 2026
**Due Date:** March 27, 2026

---

## From

**Acme Development LLC**
123 Tech Street, Suite 400
San Francisco, CA 94102
billing@acmedev.com

## Bill To

**Client Corp**
456 Business Ave
New York, NY 10001
accounts@clientcorp.com

---

## Items

| Description | Qty | Rate | Amount |
|-------------|-----|------|--------|
| Web Application Development | 40 hrs | $150/hr | $6,000 |
| UI/UX Design | 16 hrs | $120/hr | $1,920 |
| API Integration | 8 hrs | $150/hr | $1,200 |
| Code Review & QA | 12 hrs | $130/hr | $1,560 |

---

**Subtotal:** $10,680
**Tax (8%):** $854.40
**Total:** **$11,534.40**

---

*Payment terms: Net 30. Please include invoice number with payment.*
```

## Try It

::: tip Interactive
Try this in the [Playground](/playground/) — paste the markdown above and click **Generate PDF**.
:::
