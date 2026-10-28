# Orange Therapeutic Services — Website

Website and staff back office for Orange Therapeutic Services (founder and owner: Sarah Adu-Peprah), a special-needs therapy and inclusion consultancy in Ghana serving families (B2C) and institutions (B2B).

- **Live site:** https://frank-peprah.github.io/orange-therapeutic-services/
- **Staff access:** https://frank-peprah.github.io/orange-therapeutic-services/admin/ (also linked in the site footer)
- **Policies:** https://frank-peprah.github.io/orange-therapeutic-services/legal.html

## How it fits together

| Part | What it does | Where |
|---|---|---|
| Public website | Single-page site, mobile-first, no build step | `index.html`, `assets/css/site.css`, `assets/js/site.js` |
| Legal pages | Renders the **published** version of each policy from the backend | `legal.html`, `assets/js/legal.js` |
| Staff admin | Sign-in, enquiries, site content, legal document review and publishing, staff, activity log | `admin/index.html`, `assets/js/admin.js`, `assets/css/admin.css` |
| Backend | Supabase (Postgres + Auth), London region, project `orange-therapeutic-services` | See [BACKEND.md](BACKEND.md) |
| Hosting | GitHub Pages, serving `main` from the repo root | Settings → Pages |

Edits made in the staff area (content, legal documents) go live immediately with no code change or redeploy. Code changes go live when pushed to `main`.

## Open-source components (self-hosted in `assets/`)

| Component | Version | Licence | Used for |
|---|---|---|---|
| [supabase-js](https://github.com/supabase/supabase-js) | 2.117.3 | MIT | Staff sign-in and data access in the admin |
| [marked](https://github.com/markedjs/marked) | 18.1.0 | MIT | Rendering legal documents written in Markdown |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.16 | MPL-2.0 / Apache-2.0 | Sanitising rendered documents |
| [jsdiff](https://github.com/kpdecker/jsdiff) | 9.0.0 | BSD-3-Clause | Showing changes between document versions |
| [Bricolage Grotesque](https://github.com/ateliertriay/bricolage) via Fontsource | 5.1.1 | OFL-1.1 | Display typeface |
| [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) via Fontsource | 5.1.1 | OFL-1.1 | Body typeface, designed for low-vision readability |

Licence texts are in `assets/licenses/`. Everything is self-hosted, so the public site makes no requests to Google or CDNs.

## Professional features included
Mobile-first responsive layout · WCAG 2.2 AA patterns (skip link, focus states, 44px+ tap targets, reduced motion, labelled forms) · dark mode · structured data (schema.org `MedicalBusiness`) · Open Graph share image · favicon, touch icon and web manifest · `sitemap.xml` and `robots.txt` (admin excluded) · custom 404 · Content Security Policy · cookie notice (essential storage only) · WhatsApp click-to-chat · enquiry form saved to the database with consent recorded against the Privacy Notice version · spam honeypot and rate limit · print-friendly legal pages.

## Before launch
See the launch checklist on the admin **Overview** page. In short:
1. Replace all content placeholders (admin → Site content).
2. Counsel review of the 7 legal drafts, then approve and publish them (admin → Legal documents). The **Privacy Notice must be live before the site is promoted.**
3. Register with Ghana's Data Protection Commission.
4. Written approval from Parents Nest International School to feature them as a client.
5. Turn off the draft banner (admin → Site content → Footer & legal).
