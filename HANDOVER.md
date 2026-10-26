# Staff Handover — Orange Therapeutic Services Website

**Project owner:** Frank Adu-Peprah · **Business owner / content approver:** Sarah Adu-Peprah
**Live site:** https://frank-peprah.github.io/orange-therapeutic-services/

Welcome. This guide is everything you need to work on the site.

## 1. What the site is
A single-page, mobile-first website for Orange Therapeutic Services, a special-needs therapy and inclusion consultancy in Ghana. It serves two audiences:
- **Families (B2C):** book an assessment; per-session or per-term therapy.
- **Institutions (B2B):** schools, NGOs, employers, government; request a proposal for training, inclusion audits and consultancy.

**Services:** Behaviour therapy · Psychological services · Special education services · Occupational therapy · Training for teachers.

## 2. Files
| File | What it is |
|---|---|
| `index.html` | The whole site: HTML, CSS (in `<style>`) and JavaScript (in `<script>`). No build step. |
| `netlify.toml` | Settings for Netlify hosting (used later for live form delivery). |
| `.nojekyll` | Tells GitHub Pages to serve files as-is. Do not delete. |
| `README.md` | Deployment notes. |

## 3. How to make a change
**Small text edit (no software needed):**
1. Open `index.html` on GitHub and click the pencil icon (Edit).
2. Use Ctrl+F to find the text and change it.
3. Click **Commit changes**, write a short message (e.g. "Add session fee"), and commit to `main`.
4. The live site updates in 1–2 minutes.

**Larger changes:** create a branch, make the edits, and open a Pull Request for Frank to review before merging into `main`.

**Rules**
- `main` = the live site. Anything committed there is public within minutes.
- Check the page on a phone after every change (or resize the browser to ~375px wide).
- Never commit passwords, API keys, client names or children's details.

## 4. Your main task: replace the placeholders
Placeholders appear on the page with **yellow diagonal stripes**. In the code each sits inside `class="ph"`. When you replace one with confirmed content, **remove `class="ph"`** so the stripes disappear. All content must be confirmed by Sarah before it goes in.

| # | Placeholder | Section | Get from |
|---|---|---|---|
| 1 | Service area ("Accra and Tema") | Hero | Sarah |
| 2 | Reply time ("one working day") | How it works | Sarah |
| 3 | Per-session fee (GH₵) | Fees & terms | Sarah |
| 4 | Per-term fee (GH₵) | Fees & terms | Sarah |
| 5 | Term dates (3 terms) | Fees & terms | Ghana Education Service calendar, confirmed by Sarah |
| 6 | Services delivered to Parents Nest | Institutions | Sarah |
| 7 | Parents Nest: partner since / pupils supported / staff trained | Institutions | Sarah |
| 8 | Proposal turnaround ("five working days") | Institutions | Sarah |
| 9 | Impact figures (4 numbers) | Impact | Sarah's records — real numbers only |
| 10 | Parent testimonial | Impact | Written consent required; first name only |
| 11 | Institution testimonial | Impact | Written consent required |
| 12 | Sarah's qualification, registration, years of practice | Team | Sarah |
| 13 | Sarah's biography | Team | Sarah, in her own words |
| 14 | Sarah's portrait photo | Team | Sarah (replace the grey box) |
| 15 | Age range served | FAQ | Sarah |
| 16 | WhatsApp number | Contact + enquiry result box | Sarah |
| 17 | Phone number | Contact + footer | Sarah |
| 18 | Email address | Contact + footer | Sarah |
| 19 | Street address | Contact + footer | Sarah |
| 20 | Opening hours | Contact | Sarah |
| 21 | Registrar-General and professional licence numbers | Footer | Sarah |

When all placeholders are cleared, remove the yellow "Draft" banner at the top of the page (the `<div class="draft">` line).

## 5. Open decisions (do not change without Frank)
- **Speech & language tile:** shown under "What we support" but not a listed service. Remove or keep?
- **Parents Nest client case:** stays only with the school's written approval.
- **Privacy notice:** a privacy page must be added before launch (Data Protection Act, 2012, Act 843).
- **Forms:** on GitHub Pages the enquiry form uses a copy-and-send-on-WhatsApp fallback. Live form delivery needs the Netlify deployment.

## 6. Checklist before telling Frank a change is done
- [ ] Content confirmed by Sarah
- [ ] Checked on phone width and desktop width
- [ ] No placeholder stripes left on the item you changed
- [ ] Commit message says what changed
