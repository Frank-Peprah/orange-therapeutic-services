/* Orange Therapeutic Services — public site behaviour.
   Talks to the backend over plain REST (no SDK) to keep the public page light. */
(function () {
  'use strict';
  var CFG = window.OTS_CONFIG || {};
  var API = CFG.supabaseUrl + '/rest/v1/';
  var HEADERS = { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' };
  var STORE = { audience: 'orange_audience', consent: 'orange_cookie_consent' };
  var content = {}; // CMS values by key

  function $(s, root) { return (root || document).querySelector(s); }
  function $all(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function digits(s) { return String(s || '').replace(/[^\d]/g, ''); }
  function isReal(key) { return content[key] && !content[key].ph && content[key].v; }

  // ---------- Year ----------
  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  // ---------- Mobile menu ----------
  var menuBtn = $('#menuBtn'), links = $('#navLinks');
  if (menuBtn && links) {
    menuBtn.addEventListener('click', function () {
      var open = links.dataset.open !== 'true';
      links.dataset.open = open; menuBtn.setAttribute('aria-expanded', open);
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) { links.dataset.open = 'false'; menuBtn.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.dataset.open === 'true') { links.dataset.open = 'false'; menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.focus(); }
    });
  }

  // ---------- Hero audience switch ----------
  var heroCopy = {
    fam: { t: 'Every child can grow. <em>We help you see how.</em>', l: 'Behaviour therapy, psychological services, special education and occupational therapy for children with autism, ADHD, learning differences and other developmental needs. Each child gets a clear plan, sessions that fit the school term, and a progress review at the end of every term.', p: 'Book an assessment', s: 'See how it works', sh: '#how', pick: 'family' },
    inst: { t: 'Inclusion that works <em>in real classrooms.</em>', l: 'Training, inclusion audits and specialist consultancy for schools, NGOs, employers and government agencies that serve children with disabilities and learning differences.', p: 'Request a proposal', s: 'See our services', sh: '#institutions', pick: 'institution' }
  };
  function setAud(a, remember) {
    var c = heroCopy[a]; if (!c || !$('#heroTitle')) return;
    $all('.switch button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.aud === a); });
    $('#heroTitle').innerHTML = c.t;
    $('#heroLede').textContent = c.l;
    var p = $('#heroPrimary'); p.textContent = c.p; p.dataset.pick = c.pick;
    var s = $('#heroSecondary'); s.textContent = c.s; s.href = c.sh;
    if (remember) store(STORE.audience, a);
  }
  $all('.switch button').forEach(function (b) { b.addEventListener('click', function () { setAud(b.dataset.aud, true); }); });
  if (store(STORE.audience) === 'inst') setAud('inst');

  // ---------- Enquiry type branching ----------
  var famF = $('#famFields'), instF = $('#instFields');
  function setType(v) {
    if (!famF) return;
    famF.hidden = v !== 'family'; instF.hidden = v !== 'institution';
    var r = $(v === 'family' ? '#t-family' : '#t-inst'); if (r) r.checked = true;
  }
  $all('input[name="type"]').forEach(function (r) { r.addEventListener('change', function () { setType(r.value); }); });
  document.addEventListener('click', function (e) { var a = e.target.closest('[data-pick]'); if (a) setType(a.dataset.pick); });

  // ---------- Copy buttons ----------
  function flash(btn, text) { var o = btn.textContent; btn.textContent = text; setTimeout(function () { btn.textContent = o; }, 1600); }
  function copyText(text, btn, sel) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash(btn, 'Copied'); }, function () { selectEl(sel, btn); });
    } else selectEl(sel, btn);
  }
  function selectEl(el, btn) { if (!el) return; var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); flash(btn, 'Selected'); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]'); if (!b) return;
    var el = document.getElementById(b.dataset.copy); if (el) copyText(el.textContent.trim(), b, el);
  });

  // ---------- WhatsApp links ----------
  function waLink(text) {
    var n = digits(content.whatsapp && content.whatsapp.v);
    if (n.indexOf('0') === 0) n = '233' + n.slice(1);
    return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
  }
  function wireWhatsApp() {
    if (!isReal('whatsapp')) return;
    $all('[data-wa]').forEach(function (a) { a.href = waLink('Hello Orange Therapeutic Services, I would like to ask about your services.'); a.target = '_blank'; a.rel = 'noopener'; a.hidden = false; });
    var fab = $('#waFab'); if (fab) { fab.href = waLink('Hello Orange Therapeutic Services, I would like to ask about your services.'); fab.target = '_blank'; fab.rel = 'noopener'; fab.hidden = false; }
  }

  // ---------- CMS hydration ----------
  function applyContent() {
    $all('[data-cms]').forEach(function (el) {
      var c = content[el.dataset.cms]; if (!c) return;
      if (c.v) el.textContent = c.v;
      el.classList.toggle('ph', !!c.ph);
    });
    var banner = $('#draftBanner');
    if (banner && content.show_draft_banner) banner.hidden = String(content.show_draft_banner.v).trim().toLowerCase() === 'no';
    var portrait = $('#portrait');
    if (portrait && isReal('founder_photo_url') && /^https:\/\//.test(content.founder_photo_url.v)) {
      portrait.textContent = '';
      var img = new Image(); img.src = content.founder_photo_url.v; img.alt = 'Sarah Adu-Peprah, founder of Orange Therapeutic Services'; img.loading = 'lazy';
      portrait.appendChild(img);
    }
    wireWhatsApp();
    updateStructuredData();
  }
  function updateStructuredData() {
    var ld = $('#ld'); if (!ld) return;
    try {
      var d = JSON.parse(ld.textContent);
      if (isReal('phone')) d.telephone = content.phone.v;
      if (isReal('email')) d.email = content.email.v;
      if (isReal('address')) d.address.streetAddress = content.address.v;
      if (isReal('hours')) d.openingHours = content.hours.v;
      if (isReal('founder_photo_url')) d.founder.image = content.founder_photo_url.v;
      ld.textContent = JSON.stringify(d);
    } catch (e) { /* keep static data */ }
  }
  function loadContent() {
    if (!CFG.supabaseUrl || !$('[data-cms]')) return;
    fetch(API + 'site_content?select=key,value,is_placeholder', { headers: HEADERS })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) {
        rows.forEach(function (r) { content[r.key] = { v: r.value, ph: r.is_placeholder }; });
        applyContent();
      })
      .catch(function () { /* offline or blocked: the built-in text stays */ });
  }
  loadContent();

  // ---------- Enquiry form ----------
  var form = $('#enquiry');
  if (form) {
    var err = $('#formErr'), btn = $('#sendBtn'), result = $('#result');
    var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    function summary(type) {
      var lines = ['Hello Orange Therapeutic Services,', '', 'Name: ' + v('name'), 'Phone: ' + v('phone')];
      if (type === 'family') {
        lines.push('Enquiry: family');
        if (v('age')) lines.push("Child's age: " + v('age'));
        if (v('concern')) lines.push('Main concern: ' + v('concern'));
        if (v('service')) lines.push('Service: ' + v('service'));
      } else {
        lines.push('Enquiry: organisation');
        if (v('org')) lines.push('Organisation: ' + v('org'));
        if (v('need')) lines.push('Need: ' + v('need'));
      }
      if (v('msg')) lines.push('', 'Note: ' + v('msg'));
      return lines.join('\n');
    }
    function showResult(ok, type, message) {
      result.textContent = '';
      var strong = document.createElement('strong'); strong.textContent = message; result.appendChild(strong);
      var txt = summary(type);
      if (!ok) {
        var p = document.createElement('span');
        p.textContent = isReal('whatsapp') ? 'Please send it to us on WhatsApp instead:' : 'Please copy it and send it to us by WhatsApp or email:';
        result.appendChild(p);
        var pre = document.createElement('pre'); pre.id = 'summaryText'; pre.textContent = txt; result.appendChild(pre);
        var row = document.createElement('div'); row.className = 'cta-row';
        if (isReal('whatsapp')) { var a = document.createElement('a'); a.className = 'btn btn-wa'; a.href = waLink(txt); a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Open WhatsApp'; row.appendChild(a); }
        var c = document.createElement('button'); c.type = 'button'; c.className = 'copy'; c.textContent = 'Copy enquiry';
        c.addEventListener('click', function () { copyText(txt, c, pre); }); row.appendChild(c);
        result.appendChild(row);
      }
      result.hidden = false; result.scrollIntoView({ block: 'nearest' });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var type = form.querySelector('input[name="type"]:checked').value;
      var missing = [];
      if (!v('name')) missing.push('your name');
      if (digits(v('phone')).length < 6) missing.push('a phone or WhatsApp number');
      if (type === 'institution' && !v('org')) missing.push('your organisation');
      if (!$('#consent').checked) missing.push('your agreement to the Privacy Notice');
      if (missing.length) { err.textContent = 'Please add ' + missing.join(', ') + ' so we can reply.'; err.hidden = false; return; }
      err.hidden = true;
      if (v('website')) { showResult(true, type, 'Thank you. Your enquiry has been sent.'); return; } // honeypot
      var body = {
        enquiry_type: type, name: v('name'), phone: v('phone'), message: v('msg') || null, consent: true,
        privacy_version: CFG.privacyVersion || null,
        child_age: type === 'family' ? (v('age') || null) : null,
        concern: type === 'family' ? (v('concern') || null) : null,
        service: type === 'family' ? (v('service') || null) : null,
        organisation: type === 'institution' ? (v('org') || null) : null,
        need: type === 'institution' ? (v('need') || null) : null
      };
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch(API + 'enquiries', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, HEADERS), body: JSON.stringify(body) })
        .then(function (r) {
          if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.message || r.status); });
          var name = v('name').split(' ')[0];
          form.reset(); setType(type);
          showResult(true, type, 'Thank you, ' + name + '. Your enquiry has been sent. We’ll contact you within ' + ((content.reply_time && !content.reply_time.ph) ? content.reply_time.v : 'one working day') + '.');
        })
        .catch(function (ex) {
          var msg = /Too many/.test(String(ex.message)) ? 'You’ve sent several enquiries in a short time.' : 'We couldn’t send your enquiry just now.';
          showResult(false, type, msg + ' Your details are ready below.');
        })
        .then(function () { btn.disabled = false; btn.textContent = 'Send enquiry'; });
    });
  }

  // ---------- Checklist sign-up ----------
  var res = $('#resForm');
  if (res) {
    res.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = $('#resEmail').value.trim(), m = $('#resMsg');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { m.textContent = 'Enter an email address like name@example.com.'; return; }
      m.textContent = 'Sending…';
      fetch(API + 'checklist_signups', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, HEADERS), body: JSON.stringify({ email: em }) })
        .then(function (r) { if (!r.ok) throw 0; res.reset(); m.textContent = 'Thanks. We’ll email the checklist to ' + em + '.'; })
        .catch(function () { m.textContent = 'Something went wrong. Please try again, or ask us on WhatsApp.'; });
    });
  }

  // ---------- Cookie notice (essential storage only) ----------
  var cookie = $('#cookie');
  function showCookie() { if (cookie) { cookie.hidden = false; var ok = $('#cookieOk'); if (ok) ok.focus({ preventScroll: true }); } }
  if (cookie) {
    var saved = null; try { saved = JSON.parse(store(STORE.consent) || 'null'); } catch (e) { saved = null; }
    var fresh = saved && saved.at && (Date.now() - saved.at) < 365 * 864e5;
    if (!fresh) cookie.hidden = false;
    $('#cookieOk').addEventListener('click', function () { store(STORE.consent, JSON.stringify({ essential: true, analytics: false, at: Date.now() })); cookie.hidden = true; });
  }
  $all('[data-cookie-settings]').forEach(function (b) { b.addEventListener('click', showCookie); });

  window.OTS = { content: content, loadContent: loadContent };
})();
