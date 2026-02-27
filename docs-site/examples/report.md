---
title: Technical Report Example
description: Generate a technical report PDF with code blocks, blockquotes, and images.
llm_summary: |
  Example demonstrating code blocks, blockquotes, images, and mixed formatting
  for a technical report style document.
---

# Technical Report Example

A technical report using code blocks, blockquotes, tables, and mixed formatting.

## Markdown Content

```markdown
# API Performance Analysis

**Author:** Engineering Team
**Date:** February 2026
**Version:** 1.0

## Executive Summary

This report analyzes the performance improvements achieved after migrating
our REST API from Express.js to Fastify framework.

> **Key Finding:** Average response time decreased by 42% across all endpoints.

## Methodology

We measured response times for the following endpoints over a 7-day period:

| Endpoint | Method | Avg Before | Avg After | Improvement |
|----------|--------|------------|-----------|-------------|
| /api/users | GET | 245ms | 142ms | 42% |
| /api/orders | GET | 389ms | 198ms | 49% |
| /api/products | POST | 167ms | 112ms | 33% |
| /api/search | GET | 523ms | 287ms | 45% |

## Implementation

The migration involved updating the server configuration:

\```javascript
import Fastify from 'fastify';

const app = Fastify({
  logger: true,
  trustProxy: true,
});

app.get('/api/users', async (request, reply) => {
  const users = await UserService.findAll();
  return { data: users, count: users.length };
});

await app.listen({ port: 3000 });
\```

## Results

- **42% faster** average response time
- **99.9% uptime** maintained during migration
- **Zero breaking changes** for API consumers
- Memory usage reduced by **18%**

> The results exceeded our initial target of 25% improvement.

## Recommendations

1. Continue monitoring performance metrics weekly
2. Consider migrating remaining microservices
3. Implement response caching for read-heavy endpoints
```

## Try It

::: tip Interactive
Try this example in the [Playground](/playground/) — paste the markdown above and click **Generate PDF**.
:::

