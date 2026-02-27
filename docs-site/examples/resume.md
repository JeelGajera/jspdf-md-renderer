---
title: Resume / CV Example
description: Generate a professional resume PDF from markdown.
llm_summary: |
  Example showing how to generate a resume/CV PDF using headings, lists, horizontal rules,
  and bold/italic text. Demonstrates typical options for a clean document layout.
---

# Resume / CV Example

Generate a professional resume from Markdown — uses headings, lists, horizontal rules, and text styles.

## Markdown Content

```markdown
# Jane Doe

**Full-Stack Developer** | jane@example.com | github.com/janedoe

---

## Summary

Experienced developer with 5+ years building scalable web applications. Passionate about clean code, developer experience, and open source.

## Experience

### Senior Developer — TechCorp
*Jan 2022 – Present*

- Led migration from monolith to microservices architecture
- Reduced API response time by **40%** through query optimization
- Mentored 3 junior developers

### Developer — StartupXYZ
*Mar 2019 – Dec 2021*

- Built the core product from scratch using React and Node.js
- Implemented CI/CD pipeline reducing deploy time by **60%**
- Managed AWS infrastructure (EC2, RDS, S3)

## Skills

- **Languages:** TypeScript, JavaScript, Python, Go
- **Frontend:** React, Vue, Next.js, Tailwind CSS
- **Backend:** Node.js, Express, FastAPI, PostgreSQL
- **Tools:** Docker, Kubernetes, GitHub Actions, Terraform

## Education

### B.S. Computer Science — State University
*2015 – 2019* | GPA: 3.8/4.0
```

## Options

```ts
const options = {
  cursor: { x: 15, y: 15 },
  page: {
    maxContentWidth: 180,
    maxContentHeight: 277,
    lineSpace: 1.5,
    defaultLineHeightFactor: 1.2,
    defaultFontSize: 11,
    defaultTitleFontSize: 13,
    topmargin: 15,
    xpading: 15,
    xmargin: 15,
    indent: 8,
  },
  font: {
    bold: { name: 'helvetica', style: 'bold' },
    regular: { name: 'helvetica', style: 'normal' },
    light: { name: 'helvetica', style: 'light' },
  },
  content: { textAlignment: 'left' },
  endCursorYHandler: () => {},
}
```

## Try It

::: tip Interactive
Try this in the [Playground](/playground/) — paste the markdown above and click **Generate PDF**.
:::
