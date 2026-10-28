# Staff Handover — Orange Therapeutic Services Website

**Project owner:** Frank Adu-Peprah · **Business owner and content approver:** Sarah Adu-Peprah
**Website:** https://frank-peprah.github.io/orange-therapeutic-services/
**Staff area:** https://frank-peprah.github.io/orange-therapeutic-services/admin/ (or **Staff access** in the website footer)

Most day-to-day work is done in the **staff area**, not in code.

## 1. Getting access
1. Ask Frank to invite your email (admin → Staff → Invite).
2. Open the staff area, choose **Create account** and use that same email.
3. Click the link in the confirmation email, then sign in.

## 2. Daily: enquiries
- **Enquiries** lists every website form submission, newest first. The number on the menu shows how many are new.
- Open one to see the details, contact the family or organisation (WhatsApp/Call buttons), then set the **status** and add **staff notes**.
- Status meanings: New → Contacted → Assessment booked → Became a client, or Closed/Spam.
- Do not copy enquiry details into personal WhatsApp groups or spreadsheets. **Export CSV** is for authorised reporting only.

## 3. Your main task: replace the placeholders
- Go to **Site content**. Each field shows what it is, an example, and whether it is **Still a placeholder**.
- Type the confirmed value. The placeholder tick clears automatically. Click **Save changes**. The website updates immediately.
- Only enter content Sarah has confirmed. Real numbers only for impact figures. Testimonials need written consent.
- Use **Preview website** (top of Site content) to see the site with unconfirmed items highlighted in yellow stripes. Visitors never see the stripes.

## 4. Legal documents
- 7 policies are loaded as **v0.1 drafts for counsel review**. Each contains `[COUNSEL NOTE: …]` items and `[placeholders]`.
- Editors: open a document, edit the text (Markdown: `##` heading, `**bold**`, `-` bullet), **Save draft**, then **Submit for review** with a change note.
- Admins: **Approve** or **Request changes**, then **Publish** with an effective date. Only published versions appear on the website.
- **Do not publish** any document until a Ghanaian-qualified lawyer has reviewed it.
- Use **Review comments** for questions. Use **Changes from vX** or **Compare with live** to see exactly what changed.

## 5. Code changes (rare)
- All website code is in this repository. `main` is the live site and updates 1–2 minutes after a commit.
- Small text that is **not** in Site content (e.g. service descriptions): edit `index.html` on GitHub (pencil icon) and commit.
- Larger changes: use a branch and a pull request for Frank to review.
- Never commit passwords, secret keys, client names or children's details.

## 6. Open decisions (do not change without Frank)
- **Speech & language tile:** shown under "What we support" but not a listed service. Remove or keep?
- **Parents Nest client case:** stays only with the school's written approval.
- **Data Protection Commission registration** before launch.

## 7. Checklist before telling Frank something is done
- [ ] Content confirmed by Sarah
- [ ] Checked on a phone and on a computer
- [ ] No yellow stripes left on the item you changed (check with Preview website)
- [ ] Enquiry statuses up to date
