/* Orange Therapeutic Services — staff admin (enquiries, site content, legal documents, staff).
   Security is enforced in the database (Row Level Security + role checks in functions);
   this UI only hides actions a role cannot perform. */
(function () {
  'use strict';
  var CFG = window.OTS_CONFIG;
  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'orange_staff_session' }
  });
  var app = document.getElementById('app');
  var ADMIN_URL = location.origin + location.pathname;
  var SITE_URL = ADMIN_URL.replace(/admin\/?(index\.html)?$/, '');
  var me = null, session = null, recovery = false, dirty = false;
  var cache = { staff: [], counts: {} };

  var ENQ_STATUSES = ['new', 'contacted', 'booked', 'converted', 'closed', 'spam'];
  var STATUS_LABEL = { new: 'New', contacted: 'Contacted', booked: 'Assessment booked', converted: 'Became a client', closed: 'Closed', spam: 'Spam',
    draft: 'Draft', in_review: 'In review', approved: 'Approved', published: 'Published', archived: 'Archived' };
  var ROLE_HELP = { admin: 'Everything, including approving and publishing legal documents and managing staff', editor: 'Manage enquiries, edit site content, draft legal documents', viewer: 'Read-only access' };

  // ---------- tiny DOM helpers (no innerHTML with user data) ----------
  function h(tag, attrs) {
    var el = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'required') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    kids.forEach(function add(c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) return c.forEach(add); el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function fmt(ts, withTime) {
    if (!ts) return '—';
    var d = new Date(ts); if (isNaN(d)) return ts;
    var o = { day: 'numeric', month: 'short', year: 'numeric' }; if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return d.toLocaleString('en-GB', o);
  }
  function ago(ts) {
    var s = (Date.now() - new Date(ts)) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (s < 86400 * 7) return Math.round(s / 86400) + ' d ago';
    return fmt(ts);
  }
  function pill(status) { return h('span', { class: 'pill s-' + status, text: STATUS_LABEL[status] || status }); }
  var motionOK = !window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var notyf = window.Notyf ? new window.Notyf({ duration: 3500, dismissible: true, ripple: motionOK, position: { x: 'right', y: 'bottom' },
    types: [{ type: 'success', background: '#1C7A44', icon: false }, { type: 'error', background: '#B54A05', icon: false, duration: 7000 }, { type: 'info', background: '#17323A', icon: false }] }) : null;
  function flash(msg, isErr) {
    if (notyf) { if (isErr) notyf.error(msg); else notyf.success(msg); return; }
    var f = h('div', { class: 'flash' + (isErr ? ' err' : ''), role: isErr ? 'alert' : 'status', text: msg });
    document.body.appendChild(f); setTimeout(function () { f.remove(); }, isErr ? 6000 : 2600);
  }
  function info(msg) { if (notyf) notyf.open({ type: 'info', message: msg }); else flash(msg); }
  // ---------- icons (Lucide sprite) ----------
  var SPRITE = '../assets/icons.svg';
  function ico(name, cls) {
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), use = document.createElementNS(NS, 'use');
    svg.setAttribute('class', cls || 'i'); svg.setAttribute('aria-hidden', 'true'); use.setAttribute('href', SPRITE + '#i-' + name); svg.appendChild(use); return svg;
  }
  // ---------- confirm dialog (native <dialog>) ----------
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var dlg = h('dialog', { class: 'confirm' + (o.danger ? ' danger' : ''), 'aria-labelledby': 'dlgTitle' });
      var done = function (val) { dlg.close(); dlg.remove(); resolve(val); };
      var ok = h('button', { class: 'btn btn-primary', type: 'button', onclick: function () { done(true); } }, o.confirm || 'Confirm');
      var cancel = h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { done(false); } }, o.cancel || 'Cancel');
      dlg.append(h('div', { class: 'dlg-body' }, h('span', { class: 'dlg-ico' }, ico(o.icon || (o.danger ? 'trash-2' : 'circle-alert'), 'i i-lg')),
        h('h2', { id: 'dlgTitle', text: o.title }), o.body ? h('p', { text: o.body }) : null), h('div', { class: 'dlg-actions' }, cancel, ok));
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); done(false); });
      document.body.appendChild(dlg);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      (o.danger ? cancel : ok).focus();
    });
  }
  // ---------- button loading state ----------
  function loading(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.lbl = btn.textContent; btn.classList.add('loading'); btn.disabled = true; btn.textContent = ''; btn.append(ico('loader-circle', 'i spin'), h('span', { text: label || 'Working…' })); }
    else { btn.classList.remove('loading'); btn.disabled = false; clear(btn).append(btn.dataset.lbl || label || ''); }
  }
  function swap(fn) { if (motionOK && document.startViewTransition) document.startViewTransition(fn); else fn(); }
  function errMsg(e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    if (/JWT|session/i.test(m)) return 'Your session has expired. Please sign in again.';
    if (/row-level security|permission denied/i.test(m)) return 'Your role does not allow this action.';
    return m;
  }
  function must(res) { if (res.error) throw res.error; return res.data; }
  function isAdmin() { return me && me.role === 'admin' && me.active; }
  function canEdit() { return me && me.active && (me.role === 'admin' || me.role === 'editor'); }
  function staffName(id) { var s = cache.staff.filter(function (x) { return x.user_id === id; })[0]; return s ? (s.full_name || s.email) : '—'; }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
    var a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(rows, cols) {
    var q = function (v) { v = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '﻿' + [cols.map(function (c) { return q(c[1]); }).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return q(r[c[0]]); }).join(','); })).join('\n');
  }
  function renderMd(md) {
    var html = window.DOMPurify.sanitize(window.marked.parse(md || '', { gfm: true, breaks: true }));
    var wrap = h('div', { class: 'doc' }); wrap.innerHTML = html;
    wrap.querySelectorAll('table').forEach(function (t) { var w = h('div', { class: 'table-scroll' }); t.parentNode.insertBefore(w, t); w.appendChild(t); });
    return wrap;
  }
  function field(label, input, hint) {
    var id = input.id || ('f' + Math.random().toString(36).slice(2, 8)); input.id = id;
    return h('div', { class: 'field' }, h('label', { for: id, text: label }), input, hint ? h('span', { class: 'hint', text: hint }) : null);
  }

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // =====================================================================
  // AUTH
  // =====================================================================
  function renderAuth(mode, note) {
    dirty = false;
    mode = mode || 'signin';
    var msg = h('p', { class: 'msg', role: 'status' }); if (note) msg.textContent = note;
    var card = h('div', { class: 'card' },
      h('a', { class: 'brand', href: SITE_URL, style: 'color:var(--ink)' },
        h('span', null, 'Orange Therapeutic', h('small', null, 'Staff access'))),
      null);
    var tabs = h('div', { class: 'tabs', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'signin'), onclick: function () { renderAuth('signin'); }, text: 'Sign in' }),
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'signup'), onclick: function () { renderAuth('signup'); }, text: 'Create account' }));
    var form;
    if (mode === 'signin') {
      var em = h('input', { type: 'email', autocomplete: 'username', required: true }), pw = h('input', { type: 'password', autocomplete: 'current-password', required: true });
      var go = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Sign in' });
      form = h('form', { onsubmit: function (e) {
        e.preventDefault(); loading(go, true, 'Signing in…'); msg.textContent = '';
        sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value }).then(function (r) {
          loading(go, false);
          if (!r.error) info('Welcome back');
          if (r.error) msg.textContent = /confirm/i.test(r.error.message) ? 'Please confirm your email address first. Check your inbox for the link.' : 'Email or password is incorrect.';
        });
      } }, field('Email', em), field('Password', pw), go,
        h('button', { type: 'button', class: 'linklike', style: 'color:var(--orange-ink);font-weight:700;justify-self:start', onclick: function () { renderAuth('forgot'); }, text: 'Forgot your password?' }));
    } else if (mode === 'signup') {
      var nm = h('input', { autocomplete: 'name', required: true }), em2 = h('input', { type: 'email', autocomplete: 'username', required: true });
      var pw2 = h('input', { type: 'password', autocomplete: 'new-password', minlength: '10', required: true });
      var go2 = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Create account' });
      form = h('form', { onsubmit: function (e) {
        e.preventDefault();
        if (pw2.value.length < 10) { msg.textContent = 'Use at least 10 characters for your password.'; return; }
        go2.disabled = true; msg.textContent = 'Creating your account…';
        sb.auth.signUp({ email: em2.value.trim(), password: pw2.value, options: { data: { full_name: nm.value.trim() }, emailRedirectTo: ADMIN_URL } }).then(function (r) {
          go2.disabled = false;
          if (r.error) { msg.textContent = r.error.message; return; }
          if (r.data.session) return; // auto-confirmed projects sign in straight away
          renderAuth('signin', 'Account created. Check your email and click the confirmation link, then sign in. If you were not invited, an administrator will need to approve your access.');
        });
      } }, h('p', { class: 'hint', text: 'For Orange staff only. Invited staff are activated automatically; anyone else waits for an administrator to approve them.' }),
        field('Full name', nm), field('Work email', em2), field('Password', pw2, 'At least 10 characters.'), go2);
    } else if (mode === 'forgot') {
      var em3 = h('input', { type: 'email', autocomplete: 'username', required: true }), go3 = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Send reset link' });
      form = h('form', { onsubmit: function (e) {
        e.preventDefault(); go3.disabled = true;
        sb.auth.resetPasswordForEmail(em3.value.trim(), { redirectTo: ADMIN_URL }).then(function () {
          go3.disabled = false; msg.textContent = 'If that email has an account, a reset link is on its way.';
        });
      } }, field('Email', em3), go3, h('button', { type: 'button', class: 'linklike', style: 'justify-self:start', onclick: function () { renderAuth('signin'); }, text: 'Back to sign in' }));
      tabs = null;
    } else if (mode === 'reset') {
      var np = h('input', { type: 'password', autocomplete: 'new-password', required: true }), go4 = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Save new password' });
      form = h('form', { onsubmit: function (e) {
        e.preventDefault();
        if (np.value.length < 10) { msg.textContent = 'Use at least 10 characters.'; return; }
        go4.disabled = true;
        sb.auth.updateUser({ password: np.value }).then(function (r) {
          go4.disabled = false;
          if (r.error) { msg.textContent = r.error.message; return; }
          recovery = false; flash('Password updated'); boot();
        });
      } }, field('New password', np, 'At least 10 characters.'), go4);
      tabs = null;
    }
    card.appendChild(h('h1', { text: mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Staff area' }));
    if (tabs) card.appendChild(tabs);
    card.appendChild(form); card.appendChild(msg);
    card.appendChild(h('a', { href: SITE_URL, class: 'hint', text: '← Back to the website' }));
    clear(app).appendChild(h('div', { class: 'auth' }, card));
    var first = card.querySelector('input'); if (first) first.focus();
  }

  function renderPending() {
    clear(app).appendChild(h('div', { class: 'auth' }, h('div', { class: 'card' },
      h('h1', { text: me && me.role && !me.active ? 'Access paused' : 'Waiting for approval' }),
      h('p', { text: me && me.role && !me.active ? 'Your staff access has been deactivated. Contact an administrator if this is a mistake.' :
        'Your account (' + (session.user.email) + ') has been created. An administrator needs to approve it before you can see the staff area.' }),
      h('div', { class: 'cta-row' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: function () { boot(); }, text: 'Check again' }),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: signOut, text: 'Sign out' })))));
  }
  function signOut() {
    (dirty ? confirmDialog({ title: 'Sign out with unsaved changes?', body: 'Your unsaved edits will be lost.', confirm: 'Sign out', danger: true, icon: 'log-out' }) : Promise.resolve(true)).then(function (yes) {
      if (!yes) return; dirty = false;
      sb.auth.signOut().then(function () { me = null; session = null; renderAuth('signin', 'You have signed out.'); info('Signed out'); });
    });
  }

  // =====================================================================
  // SHELL + ROUTER
  // =====================================================================
  var VIEWS = [
    ['overview', 'Overview', false, 'layout-dashboard'], ['enquiries', 'Enquiries', false, 'inbox'], ['content', 'Site content', false, 'file-pen'], ['legal', 'Legal documents', false, 'scale'],
    ['signups', 'Checklist sign-ups', false, 'mail-check'], ['staff', 'Staff', true, 'user-cog'], ['activity', 'Activity log', true, 'history'], ['account', 'My account', false, 'circle-user']
  ];
  var pane;
  function renderShell() {
    var nav = h('nav', { 'aria-label': 'Staff sections' });
    VIEWS.forEach(function (v) {
      if (v[2] && !isAdmin()) return;
      nav.appendChild(h('a', { href: '#' + v[0], 'data-view': v[0] }, h('span', { class: 'nav-l' }, ico(v[3]), h('span', { text: v[1] })), h('span', { class: 'count', 'data-count': v[0], hidden: true })));
    });
    pane = h('main', { class: 'pane', id: 'pane', tabindex: '-1' });
    clear(app).appendChild(h('div', { class: 'admin-shell' },
      h('aside', { class: 'side' },
        h('a', { class: 'brand', href: SITE_URL, target: '_blank', rel: 'noopener' },
          h('span', null, 'Orange Therapeutic', h('small', null, 'Staff area'))),
        nav,
        h('div', { class: 'who' }, h('div', null, h('b', { text: me.full_name || me.email }), h('span', { text: (me.role || '') + ' · ' + me.email })),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: signOut }, ico('log-out'), ' Sign out'))),
      pane));
    refreshCounts();
    route();
  }
  function setCount(view, n) {
    var el = app.querySelector('[data-count="' + view + '"]'); if (!el) return;
    el.textContent = n; el.hidden = !n;
  }
  function refreshCounts() {
    sb.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new').then(function (r) { cache.counts.newEnq = r.count || 0; setCount('enquiries', r.count || 0); });
    sb.from('legal_versions').select('id', { count: 'exact', head: true }).eq('status', isAdmin() ? 'in_review' : 'draft').then(function (r) { setCount('legal', isAdmin() ? (r.count || 0) : 0); });
    if (isAdmin()) sb.from('staff').select('user_id', { count: 'exact', head: true }).is('role', null).then(function (r) { setCount('staff', r.count || 0); });
  }
  function route() {
    if (dirty) {
      var target = location.hash.replace('#', '') || 'overview';
      if (target !== route.full) {
        history.replaceState(null, '', '#' + route.full);
        confirmDialog({ title: 'Leave without saving?', body: 'You have unsaved changes on this page.', confirm: 'Leave and discard', cancel: 'Stay and keep editing', danger: true, icon: 'circle-alert' })
          .then(function (yes) { if (yes) { dirty = false; location.hash = '#' + target; } });
        return;
      }
    }
    dirty = false;
    var parts = location.hash.replace('#', '').split('/'), view = parts[0] || 'overview';
    if (!VIEWS.some(function (v) { return v[0] === view && (!v[2] || isAdmin()); })) view = 'overview';
    route.current = view; route.full = location.hash.replace('#', '') || 'overview';
    app.querySelectorAll('[data-view]').forEach(function (a) { if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    pane.classList.add('is-loading');
    var fn = { overview: viewOverview, enquiries: viewEnquiries, content: viewContent, legal: viewLegal, signups: viewSignups, staff: viewStaff, activity: viewActivity, account: viewAccount }[view];
    Promise.resolve().then(function () { return fn(parts.slice(1)); }).then(function () {
      pane.classList.remove('is-loading'); pane.focus({ preventScroll: true }); window.scrollTo(0, 0);
    }).catch(function (e) {
      pane.classList.remove('is-loading');
      clear(pane).appendChild(h('div', { class: 'card' }, h('strong', { text: 'Something went wrong loading this page.' }), h('p', { class: 'muted', text: errMsg(e) })));
    });
  }
  window.addEventListener('hashchange', function () { if (me && me.active) route(); });
  function head(title, sub, tools) {
    return h('div', { class: 'pane-head' }, h('div', null, h('h1', { text: title }), sub ? h('p', { text: sub }) : null), tools ? h('div', { class: 'tools' }, tools) : null);
  }

  // =====================================================================
  // OVERVIEW
  // =====================================================================
  function viewOverview() {
    var since = new Date(Date.now() - 30 * 864e5).toISOString();
    return Promise.all([
      sb.from('enquiries').select('id,created_at,enquiry_type,name,status,concern,need,organisation').order('created_at', { ascending: false }).limit(6),
      sb.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      sb.from('enquiries').select('id', { count: 'exact', head: true }).gte('created_at', since),
      sb.from('site_content').select('key,value,is_placeholder'),
      sb.from('legal_versions').select('slug,status')
    ]).then(function (r) {
      var recent = must(r[0]), newCount = r[1].count || 0, monthCount = r[2].count || 0, content = must(r[3]), legal = must(r[4]);
      var ph = content.filter(function (c) { return c.is_placeholder; }).length;
      var published = {}; legal.forEach(function (l) { if (l.status === 'published') published[l.slug] = 1; });
      var inReview = legal.filter(function (l) { return l.status === 'in_review'; }).length;
      var docsTotal = Object.keys(legal.reduce(function (a, l) { a[l.slug] = 1; return a; }, {})).length;
      clear(pane).append(
        head('Good ' + (new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening') + ', ' + ((me.full_name || '').split(' ')[0] || 'there'), 'Here is where the website stands today.'),
        h('div', { class: 'grid-4' },
          h('a', { class: 'card kpi' + (newCount ? ' alert' : ''), href: '#enquiries', style: 'text-decoration:none' }, h('b', { text: newCount }), h('span', { text: 'new enquiries waiting' })),
          h('div', { class: 'card kpi' }, h('b', { text: monthCount }), h('span', { text: 'enquiries in the last 30 days' })),
          h('a', { class: 'card kpi' + (ph ? ' alert' : ''), href: '#content', style: 'text-decoration:none' }, h('b', { text: ph }), h('span', { text: 'placeholders still on the site' })),
          h('a', { class: 'card kpi' + (inReview ? ' alert' : ''), href: '#legal', style: 'text-decoration:none' }, h('b', { text: inReview }), h('span', { text: 'legal documents awaiting review' }))),
        h('div', { class: 'card', style: 'margin-top:16px' },
          h('h2', { style: 'font-size:1.15rem;margin-bottom:10px', text: 'Launch checklist' }),
          h('ul', { style: 'margin:0;padding-left:20px;display:grid;gap:6px' },
            h('li', null, ph ? ph + ' content placeholders to replace. ' : '✓ All content confirmed. ', h('a', { href: '#content', text: 'Site content' })),
            h('li', null, Object.keys(published).length + ' of ' + docsTotal + ' legal documents published (after counsel review). ', h('a', { href: '#legal', text: 'Legal documents' })),
            h('li', null, 'Use ', h('a', { href: SITE_URL + '?review=1', target: '_blank', rel: 'noopener', text: 'Preview website' }), ' to see unconfirmed items highlighted. Visitors never see the highlighting.'),
            h('li', { text: 'Privacy Notice must be published before the site is promoted, because the forms collect personal data (Act 843).' }))),
        h('div', { class: 'card', style: 'margin-top:16px' },
          h('div', { class: 'pane-head', style: 'margin-bottom:8px' }, h('h2', { style: 'font-size:1.15rem', text: 'Latest enquiries' }), h('a', { class: 'btn btn-ghost btn-sm', href: '#enquiries', text: 'See all' })),
          recent.length ? enquiryTable(recent, true) : h('p', { class: 'empty', text: 'No enquiries yet. They will appear here as soon as someone uses the website form.' })));
    });
  }

  // =====================================================================
  // ENQUIRIES
  // =====================================================================
  var enqFilter = { status: 'open', type: '', q: '' };
  function enquiryTable(rows, compact) {
    var tb = h('tbody');
    rows.forEach(function (r) {
      tb.appendChild(h('tr', { 'data-id': r.id, tabindex: '0', onclick: function () { openEnquiry(r.id); }, onkeydown: function (e) { if (e.key === 'Enter') openEnquiry(r.id); } },
        h('td', null, h('strong', { text: r.name }), h('div', { class: 'hint', text: r.enquiry_type === 'family' ? 'Family' : (r.organisation || 'Organisation') })),
        h('td', { 'data-k': 'extra', text: r.enquiry_type === 'family' ? [r.concern, r.service].filter(Boolean).join(' · ') || '—' : (r.need || '—') }),
        h('td', { 'data-k': 'status' }, pill(r.status)),
        h('td', { class: 'num', 'data-k': 'when', text: ago(r.created_at) })));
    });
    return h('div', { class: 'table-wrap' }, h('table', { class: 'data cards' },
      h('thead', null, h('tr', null, h('th', { text: 'From' }), h('th', { text: 'About' }), h('th', { text: 'Status' }), h('th', { text: 'Received' }))), tb));
  }
  function viewEnquiries() {
    var q = sb.from('enquiries').select('*').order('created_at', { ascending: false }).limit(1000);
    return q.then(function (r) {
      var all = must(r);
      var statusSel = h('select', { 'aria-label': 'Filter by status', onchange: function () { enqFilter.status = statusSel.value; draw(); } },
        [['open', 'Open (new, contacted, booked)'], ['', 'All statuses']].concat(ENQ_STATUSES.map(function (s) { return [s, STATUS_LABEL[s]]; })).map(function (o) { return h('option', { value: o[0], selected: enqFilter.status === o[0], text: o[1] }); }));
      var typeSel = h('select', { 'aria-label': 'Filter by type', onchange: function () { enqFilter.type = typeSel.value; draw(); } },
        [['', 'Families & organisations'], ['family', 'Families'], ['institution', 'Organisations']].map(function (o) { return h('option', { value: o[0], selected: enqFilter.type === o[0], text: o[1] }); }));
      var search = h('input', { type: 'search', placeholder: 'Search name, phone, organisation', 'aria-label': 'Search enquiries', value: enqFilter.q, oninput: function () { enqFilter.q = search.value; draw(); } });
      var exp = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Export CSV', onclick: function () {
        download('orange-enquiries-' + new Date().toISOString().slice(0, 10) + '.csv', csv(filtered(), [['created_at', 'Received'], ['enquiry_type', 'Type'], ['name', 'Name'], ['phone', 'Phone'], ['child_age', 'Child age'], ['concern', 'Concern'], ['service', 'Service'], ['organisation', 'Organisation'], ['need', 'Need'], ['message', 'Message'], ['status', 'Status'], ['staff_notes', 'Staff notes']]));
      } });
      var list = h('div');
      function filtered() {
        var t = enqFilter.q.trim().toLowerCase();
        return all.filter(function (e) {
          if (enqFilter.status === 'open' && ['new', 'contacted', 'booked'].indexOf(e.status) < 0) return false;
          if (enqFilter.status && enqFilter.status !== 'open' && e.status !== enqFilter.status) return false;
          if (enqFilter.type && e.enquiry_type !== enqFilter.type) return false;
          if (t && [e.name, e.phone, e.organisation, e.concern, e.message].join(' ').toLowerCase().indexOf(t) < 0) return false;
          return true;
        });
      }
      function draw() { var f = filtered(); clear(list).appendChild(f.length ? enquiryTable(f) : h('p', { class: 'card empty', text: all.length ? 'No enquiries match these filters.' : 'No enquiries yet. Submissions from the website form appear here.' })); }
      clear(pane).append(head('Enquiries', all.length + ' total · newest first. Personal data: handle under the Privacy Notice.', [statusSel, typeSel, search, exp]), list);
      draw();
    });
  }
  function openEnquiry(id) {
    sb.from('enquiries').select('*').eq('id', id).single().then(function (r) {
      var e = must(r);
      var status = h('select', { disabled: !canEdit() }, ENQ_STATUSES.map(function (s) { return h('option', { value: s, selected: e.status === s, text: STATUS_LABEL[s] }); }));
      var assign = h('select', { disabled: !canEdit() }, [h('option', { value: '', text: 'Unassigned' })].concat(cache.staff.filter(function (s) { return s.active && s.role; }).map(function (s) { return h('option', { value: s.user_id, selected: e.assigned_to === s.user_id, text: s.full_name || s.email }); })));
      var notes = h('textarea', { rows: '5', disabled: !canEdit(), value: e.staff_notes || '', placeholder: 'Internal notes: calls made, outcome, next step. Not visible to the family.' });
      var phoneDigits = String(e.phone || '').replace(/[^\d]/g, '').replace(/^0/, '233');
      var facts = [['Received', fmt(e.created_at, true)], ['Type', e.enquiry_type === 'family' ? 'Family' : 'Organisation'], ['Phone', e.phone]];
      if (e.enquiry_type === 'family') facts.push(['Child’s age', e.child_age], ['Main concern', e.concern], ['Service', e.service]);
      else facts.push(['Organisation', e.organisation], ['Need', e.need]);
      facts.push(['Message', e.message], ['Privacy notice', e.privacy_version ? 'v' + e.privacy_version + ' accepted' : 'accepted']);
      var dl = h('dl', { class: 'facts' }); facts.forEach(function (f) { dl.append(h('dt', { text: f[0] }), h('dd', { text: f[1] || '—' })); });
      var save = h('button', { class: 'btn btn-primary', type: 'button', hidden: !canEdit(), text: 'Save', onclick: function () {
        loading(save, true, 'Saving…');
        sb.from('enquiries').update({ status: status.value, assigned_to: assign.value || null, staff_notes: notes.value.trim() || null }).eq('id', id).then(function (u) {
          loading(save, false); if (u.error) return flash(errMsg(u.error), true);
          flash('Enquiry updated: ' + STATUS_LABEL[status.value]); closeDrawer(); refreshCounts(); if (route.current === 'enquiries' || route.current === 'overview') route();
        });
      } });
      var del = isAdmin() ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () {
        confirmDialog({ title: 'Delete this enquiry?', body: 'The enquiry from ' + e.name + ' will be permanently removed. This cannot be undone.', confirm: 'Delete permanently', danger: true }).then(function (yes) {
          if (!yes) return;
          sb.from('enquiries').delete().eq('id', id).then(function (d) { if (d.error) return flash(errMsg(d.error), true); flash('Enquiry deleted'); closeDrawer(); route(); refreshCounts(); });
        });
      } }, ico('trash-2'), ' Delete') : null;
      openDrawer(e.name, [
        h('div', { class: 'cta-row' },
          h('a', { class: 'btn btn-wa btn-sm', href: 'https://wa.me/' + phoneDigits, target: '_blank', rel: 'noopener', text: 'WhatsApp' }),
          h('a', { class: 'btn btn-ghost btn-sm', href: 'tel:' + String(e.phone).replace(/\s/g, ''), text: 'Call' })),
        dl,
        h('div', { class: 'two' }, field('Status', status), field('Assigned to', assign)),
        field('Staff notes', notes),
        h('div', { class: 'cta-row' }, save, del),
        h('p', { class: 'hint', text: 'Retention: delete enquiries that do not become clients after 12 months (Privacy Notice, section 9).' })
      ]);
    }).catch(function (e) { flash(errMsg(e), true); });
  }
  var drawerEls = null, lastFocus = null;
  function openDrawer(title, body) {
    closeDrawer(); lastFocus = document.activeElement;
    var x = h('button', { class: 'x', type: 'button', 'aria-label': 'Close', onclick: closeDrawer, text: '×' });
    var bg = h('div', { class: 'drawer-bg', onclick: closeDrawer });
    var dr = h('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'drawer-head' }, h('h2', { text: title }), x), body);
    document.body.append(bg, dr); drawerEls = [bg, dr]; x.focus();
  }
  function closeDrawer() { if (drawerEls) { drawerEls.forEach(function (e) { e.remove(); }); drawerEls = null; if (lastFocus) lastFocus.focus(); } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawerEls) closeDrawer(); });

  // =====================================================================
  // SITE CONTENT
  // =====================================================================
  function viewContent() {
    return sb.from('site_content').select('*').order('sort').then(function (r) {
      var rows = must(r), changed = {};
      var counter = h('span'), saveAll = h('button', { class: 'btn btn-sun btn-sm', type: 'button', text: 'Save changes', disabled: true });
      var bar = h('div', { class: 'savebar', hidden: true }, counter, h('div', { class: 'cta-row' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', style: 'color:var(--bg);border-color:var(--bg)', text: 'Discard', onclick: function () {
          confirmDialog({ title: 'Discard your changes?', body: 'Unsaved edits on this page will be lost.', confirm: 'Discard', danger: true, icon: 'trash-2' }).then(function (yes) { if (yes) { dirty = false; route(); info('Changes discarded'); } });
        } }), saveAll));
      function mark() {
        var n = Object.keys(changed).length; dirty = n > 0;
        counter.textContent = n + ' unsaved change' + (n === 1 ? '' : 's'); bar.hidden = !n; saveAll.disabled = !n;
      }
      var sections = {}, order = [];
      rows.forEach(function (row) { if (!sections[row.section]) { sections[row.section] = []; order.push(row.section); } sections[row.section].push(row); });
      var wrap = h('div', { class: 'stack' });
      order.forEach(function (sec) {
        var card = h('section', { class: 'card cms-section' }, h('h2', { text: sec.replace(/^\d+\.\s*/, '') }));
        sections[sec].forEach(function (row) {
          var long = row.value.length > 90 || /bio|testimonial/.test(row.key);
          var inp = long ? h('textarea', { rows: '4', value: row.value, disabled: !canEdit() }) : h('input', { value: row.value, disabled: !canEdit() });
          inp.id = 'c-' + row.key;
          var ph = h('input', { type: 'checkbox', checked: row.is_placeholder, disabled: !canEdit() });
          var box = h('div', { class: 'cms-field' },
            h('label', { for: inp.id, text: row.label }),
            row.key === 'show_draft_banner' ? h('span') : h('label', { class: 'check' }, ph, h('span', { text: 'Still a placeholder' })),
            row.help ? h('span', { class: 'hint', text: row.help }) : null,
            h('div', { class: 'inputs' }, inp, h('div', { class: 'meta', text: row.updated_by ? 'Last changed ' + fmt(row.updated_at, true) + ' by ' + staffName(row.updated_by) : 'Not yet edited' })));
          function onChange() {
            var v = inp.value, p = row.key === 'show_draft_banner' ? false : ph.checked;
            if (v !== row.value || p !== row.is_placeholder) { changed[row.key] = { value: v, is_placeholder: p }; box.classList.add('dirty'); }
            else { delete changed[row.key]; box.classList.remove('dirty'); }
            mark();
          }
          inp.addEventListener('input', function () { if (inp.value !== row.value && row.is_placeholder && ph.checked && row.key !== 'show_draft_banner') ph.checked = false; onChange(); });
          ph.addEventListener('change', onChange);
          card.appendChild(box);
        });
        wrap.appendChild(card);
      });
      saveAll.addEventListener('click', function () {
        var keys = Object.keys(changed); loading(saveAll, true, 'Saving…');
        Promise.all(keys.map(function (k) { return sb.from('site_content').update(changed[k]).eq('key', k).then(must); })).then(function () {
          dirty = false; flash(keys.length + ' change' + (keys.length === 1 ? '' : 's') + ' saved. The website updates immediately.'); route();
        }).catch(function (e) { loading(saveAll, false); flash(errMsg(e), true); });
      });
      var remaining = rows.filter(function (x) { return x.is_placeholder; }).length;
      clear(pane).append(head('Site content', remaining + ' placeholder' + (remaining === 1 ? '' : 's') + ' left. Changes go live on the website as soon as you save.',
        [h('a', { class: 'btn btn-ghost btn-sm', href: SITE_URL + '?review=1', target: '_blank', rel: 'noopener' }, ico('eye'), ' Preview website')]),
        canEdit() ? null : h('p', { class: 'notice', text: 'You have read-only access.' }), wrap, bar);
    });
  }

  // =====================================================================
  // LEGAL DOCUMENTS
  // =====================================================================
  function viewLegal(parts) {
    if (parts[0]) return viewLegalDoc(parts[0]);
    return Promise.all([sb.from('legal_documents').select('*').order('sort'), sb.from('legal_versions').select('id,slug,version,status,updated_at,published_at,effective_date').order('created_at', { ascending: false })]).then(function (r) {
      var docs = must(r[0]), vers = must(r[1]);
      var list = h('div', { class: 'doc-list' });
      docs.forEach(function (d) {
        var mine = vers.filter(function (v) { return v.slug === d.slug; });
        var pub = mine.filter(function (v) { return v.status === 'published'; })[0];
        var open = mine.filter(function (v) { return ['draft', 'in_review', 'approved'].indexOf(v.status) >= 0; })[0];
        list.appendChild(h('a', { class: 'doc-row', href: '#legal/' + d.slug },
          h('div', null, h('h3', { text: d.title }),
            h('div', { class: 'sub', text: (pub ? 'Live: v' + pub.version + (pub.effective_date ? ', effective ' + fmt(pub.effective_date) : '') : 'Not yet on the website') + (open ? ' · Working on v' + open.version + ', edited ' + ago(open.updated_at) : '') })),
          h('div', { class: 'pills' }, open ? pill(open.status) : null, pub ? pill('published') : null)));
      });
      clear(pane).append(
        head('Legal documents', 'Draft → In review → Approved → Published. Editors draft; administrators approve and publish. Only published versions appear on the website.'),
        h('p', { class: 'notice', style: 'margin-bottom:14px', text: 'All documents are v0.1 drafts for counsel review. Each contains [COUNSEL NOTE] items and [placeholders] to resolve before approval. Do not publish until a Ghanaian-qualified lawyer has reviewed them.' }),
        list);
    });
  }
  function viewLegalDoc(slug) {
    return Promise.all([
      sb.from('legal_documents').select('*').eq('slug', slug).single(),
      sb.from('legal_versions').select('*').eq('slug', slug).order('created_at', { ascending: false })
    ]).then(function (r) {
      var docRow = must(r[0]), vers = must(r[1]);
      var work = vers.filter(function (v) { return ['draft', 'in_review', 'approved'].indexOf(v.status) >= 0; })[0];
      var pub = vers.filter(function (v) { return v.status === 'published'; })[0];
      var current = work || pub || vers[0];
      var editable = current && current.status === 'draft' && canEdit();

      var titleIn = h('input', { value: current.title, disabled: !editable, 'aria-label': 'Document title' });
      var ta = h('textarea', { value: current.body_md, disabled: !editable, spellcheck: 'true', 'aria-label': 'Document text (Markdown)' });
      var noteIn = h('input', { value: current.change_note || '', disabled: !editable, placeholder: 'e.g. Updated retention periods after counsel review' });
      var preview = h('div', { class: 'card preview' });
      var showPreview = true;
      function drawPreview() { clear(preview).appendChild(renderMd(ta.value)); }
      drawPreview();
      var t; ta.addEventListener('input', function () { dirty = true; saveBtn.disabled = false; clearTimeout(t); t = setTimeout(drawPreview, 250); });
      titleIn.addEventListener('input', function () { dirty = true; saveBtn.disabled = false; });
      noteIn.addEventListener('input', function () { dirty = true; saveBtn.disabled = false; });
      var editorGrid = h('div', { class: 'editor' }, h('div', { class: 'stack' }, ta), preview);
      var togglePrev = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Hide preview', onclick: function () {
        showPreview = !showPreview; preview.hidden = !showPreview; editorGrid.classList.toggle('single', !showPreview); togglePrev.textContent = showPreview ? 'Hide preview' : 'Show preview';
      } });

      function save() {
        if (!editable) return Promise.resolve();
        loading(saveBtn, true, 'Saving…');
        return sb.from('legal_versions').update({ title: titleIn.value.trim() || current.title, body_md: ta.value, change_note: noteIn.value.trim() || null }).eq('id', current.id).then(function (u) {
          loading(saveBtn, false); saveBtn.textContent = 'Save draft';
          if (u.error) { flash(errMsg(u.error), true); throw u.error; }
          saveBtn.disabled = true; dirty = false; flash('Draft saved at ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        });
      }
      function rpc(name, args, ok, btn) {
        if (btn) loading(btn, true, 'Working…');
        return sb.rpc(name, args).then(function (x) { if (btn) loading(btn, false); if (x.error) { flash(errMsg(x.error), true); return; } dirty = false; flash(ok); refreshCounts(); route(); });
      }
      var saveBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Save draft', disabled: true, onclick: save });
      var actions = h('div', { class: 'workflow' });
      if (current.status === 'draft' && canEdit()) {
        var subBtn = h('button', { class: 'btn btn-teal btn-sm', type: 'button', onclick: function () {
          confirmDialog({ title: 'Submit v' + current.version + ' for review?', body: 'Editing locks until an administrator approves it or sends it back with comments.', confirm: 'Submit for review', icon: 'send' }).then(function (yes) {
            if (!yes) return;
            (dirty ? save() : Promise.resolve()).then(function () { rpc('legal_submit', { p_id: current.id, p_note: noteIn.value.trim() || null }, 'Sent for review', subBtn); }).catch(function () {});
          });
        } }, ico('send'), ' Submit for review');
        actions.append(saveBtn, subBtn);
      }
      if (current.status === 'in_review' && isAdmin()) {
        actions.append(
          h('button', { class: 'btn btn-teal btn-sm', type: 'button', onclick: function (ev) { var b = ev.currentTarget; confirmDialog({ title: 'Approve v' + current.version + '?', body: 'Approval confirms the text is final. You can then publish it with an effective date.', confirm: 'Approve', icon: 'circle-check' }).then(function (yes) { if (yes) rpc('legal_approve', { p_id: current.id }, 'Approved. Publish when ready.', b); }); } }, ico('circle-check'), ' Approve'),
          requestChangesBtn());
      }
      if (current.status === 'approved' && isAdmin()) {
        var eff = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10), 'aria-label': 'Effective date', style: 'width:auto;min-height:40px' });
        var pubBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: function () {
          confirmDialog({ title: 'Publish ' + docRow.title + ' v' + current.version + '?', body: 'It will appear on the website immediately, effective ' + (eff.value || 'today') + '.' + (pub ? ' Live v' + pub.version + ' will be archived.' : '') + ' Confirm counsel has approved this text.', confirm: 'Publish now', icon: 'send' })
            .then(function (yes) { if (yes) rpc('legal_publish', { p_id: current.id, p_effective: eff.value || null }, 'Published. It is now live on the website.', pubBtn); });
        } }, ico('send'), ' Publish to website');
        actions.append(h('label', { class: 'hint', text: 'Effective from' }), eff, pubBtn, requestChangesBtn());
      }
      if ((current.status === 'published' || current.status === 'archived') && canEdit()) {
        actions.append(h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Start a new version', onclick: function () {
          sb.rpc('legal_new_version', { p_slug: slug }).then(function (x) { if (x.error) return flash(errMsg(x.error), true); flash('New draft created from v' + current.version); route(); });
        } }));
      }
      if (pub && isAdmin()) {
        var unpub = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Take off website', onclick: function () {
          confirmDialog({ title: 'Take ' + docRow.title + ' off the website?', body: 'Visitors will see "being finalised" until a new version is published. Policies such as the Privacy Notice should stay live while the forms collect data.', confirm: 'Take it down', danger: true, icon: 'circle-alert' })
            .then(function (yes) { if (yes) rpc('legal_unpublish', { p_slug: slug }, 'Removed from the website', unpub); });
        } });
        actions.append(unpub);
      }
      if (pub && current !== pub) actions.append(h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Compare with live v' + pub.version, onclick: function () { showDiff(pub, { version: current.version + ' (unsaved edits included)', body_md: ta.value }); } }));
      actions.append(togglePrev);
      function requestChangesBtn() {
        return h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Request changes', onclick: function () {
          var note = h('textarea', { rows: '4', placeholder: 'What needs to change?' });
          openDrawer('Request changes', [field('Note for the editor', note), h('button', { class: 'btn btn-primary', type: 'button', text: 'Send back to draft', onclick: function () {
            if (!note.value.trim()) return flash('Add a short note so the editor knows what to change.', true);
            closeDrawer(); rpc('legal_request_changes', { p_id: current.id, p_note: note.value.trim() }, 'Sent back to draft with your note');
          } })]);
        } });
      }
      document.onkeydown = function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && editable && route.current === 'legal') { e.preventDefault(); if (dirty) save().catch(function () {}); } };

      var stage = ['draft', 'in_review', 'approved', 'published'];
      var steps = h('div', { class: 'steps-mini' }); stage.forEach(function (s, i) { steps.append(h('span', { class: current.status === s ? 'on' : '', text: STATUS_LABEL[s] })); if (i < 3) steps.append(h('span', { text: '→' })); });

      // History + comments
      var hist = h('ul', { class: 'versions' });
      vers.forEach(function (v, i) {
        var prev = vers[i + 1];
        hist.appendChild(h('li', null,
          h('div', null, h('strong', { text: 'v' + v.version + ' ' }), pill(v.status)),
          h('span', { class: 'hint', text: (v.change_note || 'No change note') + ' · ' + fmt(v.updated_at, true) + (v.updated_by || v.created_by ? ' · ' + staffName(v.updated_by || v.created_by) : '') }),
          h('div', { class: 'cta-row', style: 'gap:6px' },
            h('button', { class: 'copy', type: 'button', text: 'View', onclick: function () { openDrawer(v.title + ' v' + v.version, [renderMd(v.body_md)]); } }),
            prev ? h('button', { class: 'copy', type: 'button', text: 'Changes from v' + prev.version, onclick: function () { showDiff(prev, v); } }) : null)));
      });
      var commentsList = h('ul', { class: 'comments' }), commentIn = h('textarea', { rows: '3', placeholder: 'Add a review comment or question' });
      function loadComments() {
        sb.from('legal_comments').select('*').eq('version_id', current.id).order('created_at').then(function (c) {
          var rows = must(c); clear(commentsList);
          if (!rows.length) commentsList.appendChild(h('li', { class: 'hint', text: 'No comments on this version yet.' }));
          rows.forEach(function (x) { commentsList.appendChild(h('li', null, h('span', { class: 'hint', text: (x.author_email || staffName(x.author)) + ' · ' + fmt(x.created_at, true) }), h('span', { text: x.body }))); });
        });
      }
      loadComments();
      var addComment = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Post comment', onclick: function () {
        var body = commentIn.value.trim(); if (!body) return;
        sb.from('legal_comments').insert({ version_id: current.id, body: body, author: session.user.id, author_email: me.email }).then(function (x) {
          if (x.error) return flash(errMsg(x.error), true); commentIn.value = ''; loadComments();
        });
      } });

      var counselCount = (ta.value.match(/\[COUNSEL NOTE/g) || []).length, phCount = (ta.value.match(/\[[^\]\n]{1,60}\]/g) || []).filter(function (s) { return !/COUNSEL NOTE/.test(s); }).length;
      clear(pane).append(
        h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: '#legal', text: 'Legal documents' }), ico('chevron-right'), h('span', { 'aria-current': 'page', text: docRow.title })),
        head(docRow.title, null, [h('a', { class: 'btn btn-ghost btn-sm', href: '#legal' }, ico('arrow-left'), ' All documents'), pub ? h('a', { class: 'btn btn-ghost btn-sm', href: SITE_URL + 'legal.html#' + slug, target: '_blank', rel: 'noopener', text: 'View on website' }) : null]),
        h('div', { class: 'legal-cols' },
          h('div', { class: 'stack' },
            h('div', { class: 'card stack' },
              h('div', { class: 'pane-head', style: 'margin:0' }, h('div', null, h('strong', { text: 'Working on v' + current.version + ' ' }), pill(current.status)), steps),
              editable ? null : h('p', { class: 'notice', text: current.status === 'draft' ? 'You have read-only access.' : current.status === 'in_review' ? (isAdmin() ? 'Review the text below, then approve it or request changes.' : 'Submitted for review. Editing is locked until an administrator approves it or sends it back.') : current.status === 'approved' ? 'Approved. An administrator can now publish it to the website.' : 'This is the live version. Start a new version to make changes.' }),
              h('div', { class: 'two' }, field('Title', titleIn), field('Change note', noteIn, 'Shown in the version history.')),
              actions,
              h('p', { class: 'hint', text: counselCount + ' counsel notes and ' + phCount + ' [placeholders] left in this version. Formatting uses Markdown: ## for headings, **bold**, - for bullets, | for tables. Ctrl/Cmd + S saves.' })),
            editorGrid),
          h('div', { class: 'side-col' },
            h('div', { class: 'card' }, h('h2', { style: 'font-size:1.05rem;margin-bottom:8px', text: 'Review comments' }), commentsList, h('div', { class: 'stack', style: 'margin-top:10px' }, commentIn, addComment)),
            h('div', { class: 'card' }, h('h2', { style: 'font-size:1.05rem;margin-bottom:8px', text: 'Version history' }), hist))));
    });
  }
  function showDiff(a, b) {
    var parts = window.Diff.diffWords(a.body_md || '', b.body_md || '');
    var box = h('div', { class: 'diff card' }), adds = 0, dels = 0;
    parts.forEach(function (p) { if (p.added) adds += p.count || 1; if (p.removed) dels += p.count || 1; box.appendChild(h(p.added ? 'ins' : p.removed ? 'del' : 'span', { text: p.value })); });
    openDrawer('Changes: v' + a.version + ' → v' + b.version, [h('p', { class: 'hint', text: 'Green = added, orange = removed. ' + (adds || dels ? '' : 'No differences.') }), box]);
  }

  // =====================================================================
  // SIGN-UPS, STAFF, ACTIVITY, ACCOUNT
  // =====================================================================
  function viewSignups() {
    return sb.from('checklist_signups').select('*').order('created_at', { ascending: false }).then(function (r) {
      var rows = must(r), tb = h('tbody');
      rows.forEach(function (x) { tb.appendChild(h('tr', null, h('td', { text: x.email }), h('td', { class: 'num', text: fmt(x.created_at, true) }))); });
      clear(pane).append(head('Checklist sign-ups', rows.length + ' people asked for the parent checklist. Send it from your email, then delete entries older than 24 months.',
        [h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Export CSV', onclick: function () { download('orange-checklist-signups.csv', csv(rows, [['email', 'Email'], ['created_at', 'Signed up']])); } })]),
        rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', { text: 'Email' }), h('th', { text: 'Signed up' }))), tb)) : h('p', { class: 'card empty', text: 'No sign-ups yet.' }));
    });
  }
  function viewStaff() {
    return Promise.all([sb.from('staff').select('*').order('created_at'), sb.from('staff_invites').select('*').order('created_at')]).then(function (r) {
      var staff = must(r[0]), invites = must(r[1]); cache.staff = staff;
      var tb = h('tbody');
      staff.forEach(function (s) {
        var role = h('select', { 'aria-label': 'Role for ' + s.email, disabled: s.user_id === me.user_id },
          [h('option', { value: '', text: 'Pending, no access', selected: !s.role })].concat(['viewer', 'editor', 'admin'].map(function (x) { return h('option', { value: x, selected: s.role === x, text: x[0].toUpperCase() + x.slice(1) }); })));
        var active = h('input', { type: 'checkbox', checked: s.active, disabled: s.user_id === me.user_id, 'aria-label': 'Active' });
        var saveB = h('button', { class: 'copy', type: 'button', text: 'Save', onclick: function () {
          var payload = { role: role.value || null, active: !!role.value && active.checked };
          if (!s.role && role.value) payload.active = true;
          sb.from('staff').update(payload).eq('user_id', s.user_id).then(function (u) { if (u.error) return flash(errMsg(u.error), true); flash('Access updated for ' + s.email); route(); refreshCounts(); });
        } });
        tb.appendChild(h('tr', null,
          h('td', null, h('strong', { text: s.full_name || '—' }), h('div', { class: 'hint', text: s.email })),
          h('td', null, s.role ? (s.active ? h('span', { class: 'pill s-converted', text: 'Active' }) : h('span', { class: 'pill s-closed', text: 'Inactive' })) : h('span', { class: 'pill s-new', text: 'Awaiting approval' })),
          h('td', null, role), h('td', null, h('label', { class: 'check' }, active, h('span', { text: 'Active' }))),
          h('td', { class: 'num', text: fmt(s.created_at) }), h('td', null, s.user_id === me.user_id ? h('span', { class: 'hint', text: 'You' }) : saveB)));
      });
      var invEmail = h('input', { type: 'email', placeholder: 'name@example.com', 'aria-label': 'Email to invite' });
      var invRole = h('select', { 'aria-label': 'Role' }, ['editor', 'viewer', 'admin'].map(function (x) { return h('option', { value: x, text: x[0].toUpperCase() + x.slice(1) }); }));
      var invList = h('ul', { class: 'versions' });
      invites.forEach(function (i) {
        var rm = h('button', { class: 'copy', type: 'button', text: 'Cancel', onclick: function () { sb.from('staff_invites').delete().eq('email', i.email).then(function (d) { if (d.error) return flash(errMsg(d.error), true); route(); }); } });
        invList.appendChild(h('li', null, h('div', null, h('strong', { text: i.email }), ' · ' + i.role), h('span', { class: 'hint', text: 'Invited ' + fmt(i.created_at) + '. Waiting for them to create an account.' }), rm));
      });
      if (!invites.length) invList.appendChild(h('li', { class: 'hint', text: 'No open invitations.' }));
      clear(pane).append(
        head('Staff', 'Who can use this staff area, and what they can do.'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, ['Person', 'Status', 'Role', 'Access', 'Joined', ''].map(function (x) { return h('th', { text: x }); }))), tb)),
        h('div', { class: 'card', style: 'margin-top:16px;display:grid;gap:12px' },
          h('h2', { style: 'font-size:1.15rem', text: 'Invite a staff member' }),
          h('p', { class: 'hint', text: 'Add their email and role. Then send them this link and ask them to choose "Create account" with the same email: ' + ADMIN_URL }),
          h('div', { class: 'tools' }, invEmail, invRole, h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Add invitation', onclick: function () {
            var em = invEmail.value.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return flash('Enter a valid email address.', true);
            sb.from('staff_invites').insert({ email: em, role: invRole.value, invited_by: session.user.id }).then(function (x) { if (x.error) return flash(/duplicate/.test(x.error.message) ? 'That email is already invited.' : errMsg(x.error), true); flash('Invitation added for ' + em); route(); });
          } })),
          h('p', { class: 'hint', text: 'Roles: ' + Object.keys(ROLE_HELP).map(function (k) { return k + ' = ' + ROLE_HELP[k]; }).join('; ') + '.' }),
          invList));
    });
  }
  var ACTION_TEXT = { site_content: 'edited site content', enquiries: 'updated an enquiry', staff: 'changed staff access', legal_versions: 'changed a legal document' };
  function viewActivity() {
    return sb.from('audit_log').select('*').order('at', { ascending: false }).limit(300).then(function (r) {
      var rows = must(r), tb = h('tbody');
      rows.forEach(function (x) {
        var d = x.detail || {}, what;
        if (x.entity === 'site_content') what = (d.label || x.entity_id) + ': "' + String(d.from || '').slice(0, 40) + '" → "' + String(d.to || '').slice(0, 40) + '"';
        else if (x.entity === 'legal_versions') what = (d.slug || '') + ' v' + (d.version || '') + (d.status_to ? ': ' + (STATUS_LABEL[d.status_from] || d.status_from) + ' → ' + (STATUS_LABEL[d.status_to] || d.status_to) : x.action === 'create' ? ': new version' : ': text edited');
        else if (x.entity === 'enquiries') what = 'Status ' + (STATUS_LABEL[d.status_from] || d.status_from) + ' → ' + (STATUS_LABEL[d.status_to] || d.status_to) + (d.notes_changed ? ', notes edited' : '');
        else if (x.entity === 'staff') what = (d.email || '') + ': role ' + (d.role_from || 'none') + ' → ' + (d.role_to || 'none') + (d.active_to === false ? ' (inactive)' : '');
        else what = x.action;
        tb.appendChild(h('tr', null, h('td', { class: 'num', text: fmt(x.at, true) }), h('td', { text: x.actor_email || 'System' }), h('td', { text: ACTION_TEXT[x.entity] || x.entity }), h('td', { text: what })));
      });
      clear(pane).append(head('Activity log', 'Every change made in the staff area, newest first (last 300).'),
        rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, ['When', 'Who', 'Action', 'Detail'].map(function (t) { return h('th', { text: t }); }))), tb)) : h('p', { class: 'card empty', text: 'No activity yet.' }));
    });
  }
  function viewAccount() {
    var pw = h('input', { type: 'password', autocomplete: 'new-password' });
    clear(pane).append(head('My account', me.email + ' · ' + me.role),
      h('div', { class: 'card stack', style: 'max-width:520px' },
        field('New password', pw, 'At least 10 characters.'),
        h('button', { class: 'btn btn-primary btn-sm', type: 'button', style: 'justify-self:start', text: 'Change password', onclick: function () {
          if (pw.value.length < 10) return flash('Use at least 10 characters.', true);
          sb.auth.updateUser({ password: pw.value }).then(function (x) { if (x.error) return flash(errMsg(x.error), true); pw.value = ''; flash('Password changed'); });
        } }),
        h('p', { class: 'hint', text: 'Your name (' + (me.full_name || 'not set') + ') can be changed by an administrator in Staff.' })),
      h('div', { class: 'card', style: 'max-width:520px;margin-top:14px' }, h('h2', { style: 'font-size:1.05rem;margin-bottom:6px', text: 'Your role' }), h('p', { text: ROLE_HELP[me.role] || 'No access yet.' })));
    return Promise.resolve();
  }

  // =====================================================================
  // BOOT
  // =====================================================================
  function boot() {
    return sb.auth.getSession().then(function (r) {
      session = r.data.session;
      if (recovery) return renderAuth('reset');
      if (!session) return renderAuth('signin');
      return sb.from('staff').select('*').eq('user_id', session.user.id).maybeSingle().then(function (s) {
        me = s.data;
        if (!me || !me.role || !me.active) return renderPending();
        return sb.from('staff').select('user_id,email,full_name,role,active').then(function (all) { cache.staff = all.data || []; renderShell(); });
      });
    }).catch(function (e) { renderAuth('signin', errMsg(e)); });
  }
  sb.auth.onAuthStateChange(function (event, s) {
    if (event === 'PASSWORD_RECOVERY') { recovery = true; session = s; renderAuth('reset'); return; }
    if (event === 'SIGNED_IN' && !me && !recovery) { setTimeout(boot, 0); }
    if (event === 'SIGNED_OUT') { me = null; }
  });
  boot();
})();
