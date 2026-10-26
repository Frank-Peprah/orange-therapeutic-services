# Orange Therapeutic Services — Website

Responsive single-page website for Orange Therapeutic Services (founder and owner: Sarah Adu-Peprah), a special-needs therapy and inclusion consultancy in Ghana serving families (B2C) and institutions (B2B).

## Status
Draft v2. Items highlighted with yellow stripes on the page are placeholders awaiting confirmation (fees, contacts, credentials, impact figures, testimonials, Parents Nest client details).

## Contents
- `index.html` — the full site (HTML, CSS and JS in one file; no build step)
- `netlify.toml` — Netlify config and security headers

## Live site (GitHub Pages)
https://frank-peprah.github.io/orange-therapeutic-services/

GitHub Pages serves `main` from the repo root. Pages cannot receive form submissions, so the enquiry form uses the copy-and-send-on-WhatsApp fallback there. Deploy on Netlify (below) to switch on live form delivery.

## Deploy (Netlify)
1. In Netlify: **Add new site → Import an existing project → GitHub**, pick this repo. Publish directory: `.` (no build command).
2. **Site configuration → Forms**: enable form detection, then trigger a redeploy. Two forms are registered: `enquiry` and `checklist`.
3. **Forms → Form notifications**: add Sarah's email for new enquiries.
4. **Domain management**: connect the custom domain.

Every push to `main` redeploys automatically.

## Before go-live
- Replace all placeholders.
- Decide on the "Speech & language delay" concern tile (not currently a listed service).
- Get written approval from Parents Nest International School to feature them as a client.
- Add a privacy notice page and register with Ghana's Data Protection Commission (enquiry forms collect children's data; Act 843).
