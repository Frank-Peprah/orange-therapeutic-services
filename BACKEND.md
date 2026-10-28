# Backend guide

**Provider:** Supabase (managed Postgres + authentication) · **Project:** `orange-therapeutic-services` · **Region:** London (eu-west-2) · **Plan:** Free
**API URL:** `https://vekihiypdosshilpjaie.supabase.co` · **Browser key:** publishable key in `assets/js/config.js` (safe to expose; never commit a secret/service-role key)

## One-time setup (owner, about 5 minutes)

1. **Supabase dashboard → Authentication → URL Configuration**
   - Site URL: `https://frank-peprah.github.io/orange-therapeutic-services/admin/`
   - Redirect URLs: add `https://frank-peprah.github.io/orange-therapeutic-services/admin/**`
   Without this, confirmation and password-reset emails link to `localhost` and fail.
2. **Create the first admin account:** open the staff area, choose **Create account** with `frank024gh@gmail.com`, then click the confirmation email. That address is pre-invited as **admin** and becomes active once confirmed.
3. **Invite staff** from admin → Staff. Invited people create an account with the same email and are activated when they confirm it.
4. Recommended: **Authentication → Sign In / Providers → Email**: keep "Confirm email" on. **Authentication → Emails → SMTP**: connect your own email service (the built-in sender is rate-limited to a few emails per hour and is for testing only).

## Data model

| Table | Holds | Public (anonymous) | Staff |
|---|---|---|---|
| `enquiries` | Website enquiry form submissions | Insert only (consent required, rate-limited) | Read all; editors update status/notes; admins delete |
| `checklist_signups` | Emails requesting the parent checklist | Insert only | Read; admins delete |
| `site_content` | 34 editable text fields shown on the website | Read | Editors update |
| `legal_documents` | The 7 policies | Read | Admins manage |
| `legal_versions` | Every version of every policy, with status | Read **published** only | Read all; editors edit **drafts** only |
| `legal_comments` | Review comments on a version | — | Read/post |
| `staff` | Staff accounts, role, active flag | — | Read; admins change roles |
| `staff_invites` | Pre-approved emails and their role | — | Admins |
| `audit_log` | Every staff change (who, what, when, before → after) | — | Admins read |

## Roles
- **Admin:** everything, including approving and publishing legal documents, managing staff and reading the activity log.
- **Editor:** manage enquiries, edit site content, draft legal documents and submit them for review.
- **Viewer:** read-only.
- **Pending:** signed up but not approved. Sees nothing.

## Legal document workflow
`Draft` → (editor) **Submit for review** → `In review` → (admin) **Approve** or **Request changes** → `Approved` → (admin) **Publish** with an effective date → `Published`. Publishing archives the previous live version. To change a live document, **Start a new version**; the live one stays up until the new one is published. Every version is kept, and any two versions can be compared word by word.

## Security controls
- Row Level Security on every table, plus least-privilege table and column grants (anonymous visitors can only insert enquiries/sign-ups and read content and published policies).
- Role checks enforced inside database functions, not just the UI.
- Invitations activate only after the invitee confirms their email.
- Cannot remove or demote the last active admin.
- Enquiry throttle: 3 per phone number per 10 minutes, 30 site-wide per minute. Anonymous visitors cannot set an enquiry's status or notes.
- Audit trail of all staff changes.
- Content Security Policy on every page; the admin page is `noindex` and excluded in `robots.txt`.
- Verified with 30 database permission tests (anonymous, pending, viewer, editor, admin) and 73 browser tests.

## Operating notes
- **Free plan pauses after 7 days without activity.** Normal site traffic counts. If it pauses, restore it from the Supabase dashboard. Upgrade to Pro (about US$25/month) before relying on it commercially. Pro adds daily backups.
- **Retention:** delete enquiries that do not become clients after 12 months, and checklist sign-ups after 24 months (Privacy Notice section 9).
- **Data location:** London, UK. This is disclosed in the Privacy Notice as a cross-border transfer under Act 843.
