/* Orange Therapeutic Services — public site behaviour.
   Talks to the backend over plain REST (no SDK) to keep the public page light.
   Toasts: Notyf (MIT). Page transitions: native View Transitions API. */
(function () {
  'use strict';
  var CFG = window.OTS_CONFIG || {};
  var API = CFG.supabaseUrl + '/rest/v1/';
  var HEADERS = { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' };
  var STORE = { audience: 'orange_audience', consent: 'orange_cookie_consent' };
  var ICONS = (document.querySelector('script[src$="site.js"]') || {}).src ? document.querySelector('script[src$="site.js"]').src.replace(/js\/site\.js.*$/, 'icons.svg') : 'assets/icons.svg';
  var motionOK = !window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var content = {}; // CMS values by key

  function $(s, root) { return (root || document).querySelector(s); }
  function $all(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function digits(s) { return String(s || '').replace(/[^\d]/g, ''); }
  function isReal(key) { return content[key] && !content[key].ph && content[key].v; }
  function icon(name, cls) { return '<svg class="' + (cls || 'i') + '" aria-hidden="true"><use href="' + ICONS + '#i-' + name + '"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- Staff review mode: ?review=1 shows placeholder stripes ----------
  try { if (new URLSearchParams(location.search).get('review') === '1') document.documentElement.classList.add('review-mode'); } catch (e) { /* old browser */ }

  // ---------- Toasts ----------
  var toast = (function () {
    if (!window.Notyf) return { success: function () {}, error: function () {}, info: function () {} };
    var n = new window.Notyf({
      duration: 4500, dismissible: true, ripple: motionOK, position: { x: 'right', y: 'bottom' },
      types: [
        { type: 'success', background: '#1C7A44', icon: false },
        { type: 'error', background: '#B54A05', icon: false, duration: 7000 },
        { type: 'info', background: '#17323A', icon: false }
      ]
    });
    return { success: function (m) { n.success(m); }, error: function (m) { n.error(m); }, info: function (m) { n.open({ type: 'info', message: m }); } };
  })();
  window.OTS_TOAST = toast;

  // ---------- Year ----------
  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  // ---------- Mobile menu ----------
  var menuBtn = $('#menuBtn'), links = $('#navLinks'), backdrop = $('#navBackdrop');
  function setMenu(open, refocus) {
    if (!links) return;
    links.dataset.open = open; menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (backdrop) backdrop.classList.toggle('show', open);
    if (open) { var f = links.querySelector('a'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 60); }
    else if (refocus) menuBtn.focus();
  }
  if (menuBtn && links) {
    menuBtn.addEventListener('click', function () { setMenu(links.dataset.open !== 'true'); });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    if (backdrop) backdrop.addEventListener('click', function () { setMenu(false, true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && links.dataset.open === 'true') setMenu(false, true); });
    window.addEventListener('resize', function () { if (innerWidth > 920 && links.dataset.open === 'true') setMenu(false); });
  }

  // ---------- Header shadow + back to top ----------
  var header = $('header.site'), toTop = $('#toTop'), ticking = false;
  function onScroll() {
    ticking = false;
    var yv = window.scrollY || 0;
    if (header) header.classList.toggle('scrolled', yv > 12);
    if (toTop) toTop.classList.toggle('show', yv > 900);
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: motionOK ? 'smooth' : 'auto' });
    var skip = $('.brand'); if (skip) skip.focus({ preventScroll: true });
  });

  // ---------- Scroll-spy: highlight the section you're reading ----------
  var spyLinks = links ? $all('a[href^="#"]:not(.btn)', links) : [];
  if (spyLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    spyLinks.forEach(function (a) { var id = a.getAttribute('href').slice(1); var el = document.getElementById(id); if (el) map[id] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          spyLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
          var a = map[en.target.id]; if (a) a.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { spy.observe(document.getElementById(id)); });
  }

  // ---------- Scroll reveal (armed only when motion is allowed) ----------
  if (motionOK && 'IntersectionObserver' in window) {
    var targets = $all('.sec-head, .door, .concern, .svc, .step, .plan, .terms, .offer, .client, .inst-cta, .stat, .story, .team > *, .res, .faq details, .channel, form.enquiry');
    targets.forEach(function (el) {
      el.classList.add('reveal');
      var sibs = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.setProperty('--d', Math.min(sibs, 6) * 0.06 + 's');
    });
    document.documentElement.classList.add('reveal-armed');
    var rev = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); rev.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    targets.forEach(function (el) {
      // anything already on screen shows immediately
      var r = el.getBoundingClientRect(); if (r.top < innerHeight) el.classList.add('in'); else rev.observe(el);
    });
  }

  // ---------- Hero audience switch ----------
  var heroCopy = {
    fam: { t: 'Every child can grow. <em>We help you see how.</em>', l: 'Behaviour therapy, psychological services, special education and occupational therapy for children with autism, ADHD, learning differences and other developmental needs. Each child gets a clear plan, sessions that fit the school term, and a progress review at the end of every term.', p: 'Book an assessment', s: 'See how it works', sh: '#how', pick: 'family' },
    inst: { t: 'Inclusion that works <em>in real classrooms.</em>', l: 'Training, inclusion audits and specialist consultancy for schools, NGOs, employers and government agencies that serve children with disabilities and learning differences.', p: 'Request a proposal', s: 'See our services', sh: '#institutions', pick: 'institution' }
  };
  function setAud(a, remember) {
    var c = heroCopy[a]; if (!c || !$('#heroTitle')) return;
    var apply = function () {
      $all('.switch button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.aud === a); });
      $('#heroTitle').innerHTML = c.t;
      $('#heroLede').textContent = c.l;
      var p = $('#heroPrimary'); p.querySelector('span').textContent = c.p; p.dataset.pick = c.pick;
      var s = $('#heroSecondary'); s.textContent = c.s; s.href = c.sh;
    };
    if (remember && motionOK && document.startViewTransition) document.startViewTransition(apply); else apply();
    if (remember) store(STORE.audience, a);
  }
  $all('.switch button').forEach(function (b) { b.addEventListener('click', function () { setAud(b.dataset.aud, true); }); });
  if (store(STORE.audience) === 'inst') setAud('inst');

  // ---------- Enquiry type branching + CTA focus ----------
  var famF = $('#famFields'), instF = $('#instFields');
  function setType(v) {
    if (!famF) return;
    famF.hidden = v !== 'family'; instF.hidden = v !== 'institution';
    var r = $(v === 'family' ? '#t-family' : '#t-inst'); if (r) r.checked = true;
  }
  $all('input[name="type"]').forEach(function (r) { r.addEventListener('change', function () { setType(r.value); }); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-pick]'); if (!a) return;
    setType(a.dataset.pick);
    if (a.getAttribute('href') === '#contact') setTimeout(function () { var n = $('#name'); if (n && !n.value) n.focus({ preventScroll: true }); }, motionOK ? 700 : 0);
  });

  // ---------- Copy buttons ----------
  function copyText(text, label) {
    var done = function () { toast.success((label || 'Text') + ' copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { toast.info('Select the text and copy it manually.'); });
    else toast.info('Select the text and copy it manually.');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]'); if (!b) return;
    var el = document.getElementById(b.dataset.copy); if (el) copyText(el.textContent.trim(), b.dataset.copy === 'telNum' ? 'Phone number' : b.dataset.copy === 'mailAddr' ? 'Email address' : 'Text');
  });

  // ---------- WhatsApp links ----------
  function waLink(text) {
    var n = digits(content.whatsapp && content.whatsapp.v);
    if (n.indexOf('0') === 0) n = '233' + n.slice(1);
    return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
  }
  function wireWhatsApp() {
    if (!isReal('whatsapp')) return;
    var hello = 'Hello Orange Therapeutic Services, I would like to ask about your services.';
    $all('[data-wa]').forEach(function (a) { a.href = waLink(hello); a.target = '_blank'; a.rel = 'noopener'; a.hidden = false; });
    var fab = $('#waFab'); if (fab) { fab.href = waLink(hello); fab.target = '_blank'; fab.rel = 'noopener'; fab.hidden = false; }
  }

  // ---------- CMS hydration ----------
  function applyContent() {
    $all('[data-cms]').forEach(function (el) {
      var c = content[el.dataset.cms]; if (!c) return;
      if (c.v) el.textContent = c.v;
      el.classList.toggle('ph', !!c.ph);
    });
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
      .then(function (rows) { rows.forEach(function (r) { content[r.key] = { v: r.value, ph: r.is_placeholder }; }); applyContent(); })
      .catch(function () { /* offline or blocked: the built-in text stays */ });
  }
  loadContent();

  // ---------- Button loading state ----------
  function busy(btn, on, label) {
    if (!btn) return;
    btn.classList.toggle('loading', on); btn.disabled = on; btn.setAttribute('aria-busy', on);
    var l = btn.querySelector('.lbl'); if (l && label) l.textContent = label;
  }

  // ---------- Enquiry form ----------
  var form = $('#enquiry');
  if (form) {
    var err = $('#formErr'), btn = $('#sendBtn');
    var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var rules = {
      name: function () { return v('name').length > 0; },
      phone: function () { return digits(v('phone')).length >= 9; },
      org: function () { return form.querySelector('input[name="type"]:checked').value !== 'institution' || v('org').length > 0; }
    };
    function check(id, show) {
      var ok = rules[id](), f = document.getElementById(id).closest('.field');
      if (show || f.classList.contains('invalid')) { f.classList.toggle('invalid', !ok); f.classList.toggle('valid', ok && !!v(id)); document.getElementById(id).setAttribute('aria-invalid', String(!ok)); }
      return ok;
    }
    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener('blur', function () { if (v(id)) check(id, true); });
      el.addEventListener('input', function () { check(id, false); });
    });
    $('#consent').addEventListener('change', function () { $('#consentLabel').classList.toggle('invalid', !this.checked && $('#consentLabel').classList.contains('invalid')); });

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
    var formHTML = form.innerHTML;
    function confirmation(name, ref, type) {
      var reply = (content.reply_time && !content.reply_time.ph) ? content.reply_time.v : 'one working day';
      var html = '<div class="confirm-panel" tabindex="-1">' +
        '<svg class="tick" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="M19 33l9 9 17-19"/></svg>' +
        '<h3>Thank you, ' + esc(name) + '. Your enquiry has been sent.</h3>' +
        '<p>Your reference is <span class="ref">' + esc(ref) + '</span></p>' +
        '<ol><li>We’ll call or WhatsApp you within ' + esc(reply) + '.</li>' +
        (type === 'family' ? '<li>We’ll talk through your concerns and book an assessment if it’s right for your child.</li>' : '<li>We’ll agree your goals and send a scoped proposal.</li>') +
        '<li>Keep your reference handy in case you need to follow up.</li></ol>' +
        '<div class="cta-row">' + (isReal('whatsapp') ? '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + esc(waLink('Hello, my enquiry reference is ' + ref + '.')) + '">' + icon('message-circle') + ' Message us on WhatsApp</a>' : '') +
        '<button type="button" class="btn btn-ghost" id="another">' + icon('plus') + ' Send another enquiry</button></div></div>';
      var show = function () {
        form.innerHTML = html;
        var p = form.querySelector('.confirm-panel'); p.focus({ preventScroll: true });
        form.scrollIntoView({ block: 'nearest', behavior: motionOK ? 'smooth' : 'auto' });
        form.querySelector('#another').addEventListener('click', function () { location.reload(); });
      };
      if (motionOK && document.startViewTransition) document.startViewTransition(show); else show();
    }
    function fallback(type, msg) {
      var box = $('#result'), txt = summary(type);
      box.innerHTML = '<strong>' + esc(msg) + '</strong><span>' + (isReal('whatsapp') ? 'Your details are ready to send on WhatsApp instead:' : 'Copy your details and send them to us by WhatsApp or email:') + '</span><pre id="summaryText"></pre><div class="cta-row"></div>';
      box.querySelector('pre').textContent = txt;
      var row = box.querySelector('.cta-row');
      if (isReal('whatsapp')) { var a = document.createElement('a'); a.className = 'btn btn-wa'; a.href = waLink(txt); a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = icon('message-circle') + ' Open WhatsApp'; row.appendChild(a); }
      var c = document.createElement('button'); c.type = 'button'; c.className = 'copy'; c.innerHTML = icon('copy') + ' Copy details';
      c.addEventListener('click', function () { copyText(txt, 'Enquiry'); }); row.appendChild(c);
      box.hidden = false; box.scrollIntoView({ block: 'nearest', behavior: motionOK ? 'smooth' : 'auto' });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var type = form.querySelector('input[name="type"]:checked').value;
      var bad = Object.keys(rules).filter(function (id) { return !check(id, true); });
      var consentOK = $('#consent').checked; $('#consentLabel').classList.toggle('invalid', !consentOK);
      if (bad.length || !consentOK) {
        err.textContent = bad.length ? 'Please fix the highlighted fields.' : 'Please tick the box to agree to how we use your details.'; err.hidden = false;
        form.classList.remove('shake'); void form.offsetWidth; if (motionOK) form.classList.add('shake');
        (bad.length ? document.getElementById(bad[0]) : $('#consent')).focus();
        toast.error(bad.length ? 'Some details are missing.' : 'Please agree to the Privacy Notice to continue.');
        return;
      }
      err.hidden = true; $('#result').hidden = true;
      if (v('website')) { confirmation(v('name').split(' ')[0], 'OTS-000000', type); return; } // honeypot
      var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : null;
      var ref = 'OTS-' + (id ? id.replace(/-/g, '').slice(0, 6).toUpperCase() : String(Date.now()).slice(-6));
      var body = {
        enquiry_type: type, name: v('name'), phone: v('phone'), message: v('msg') || null, consent: true,
        privacy_version: CFG.privacyVersion || null,
        child_age: type === 'family' ? (v('age') || null) : null,
        concern: type === 'family' ? (v('concern') || null) : null,
        service: type === 'family' ? (v('service') || null) : null,
        organisation: type === 'institution' ? (v('org') || null) : null,
        need: type === 'institution' ? (v('need') || null) : null
      };
      if (id) body.id = id;
      busy(btn, true, 'Sending…');
      fetch(API + 'enquiries', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, HEADERS), body: JSON.stringify(body) })
        .then(function (r) {
          if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.message || r.status); });
          return true;
        })
        .then(function (sent) {
          if (!sent) return;
          toast.success('Enquiry sent. Reference ' + ref);
          try { confirmation(v('name').split(' ')[0], ref, type); } catch (e) { /* panel is cosmetic; the enquiry is already saved */ }
        }, function (ex) {
          busy(btn, false, 'Send enquiry');
          var msg = /Too many/.test(String(ex.message)) ? 'You’ve sent several enquiries in a short time.' : 'We couldn’t send your enquiry just now.';
          toast.error(msg);
          fallback(type, msg);
        });
    });
  }

  // ---------- Checklist sign-up ----------
  var res = $('#resForm');
  if (res) {
    res.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = $('#resEmail').value.trim(), m = $('#resMsg'), b = $('#resBtn');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
        m.innerHTML = icon('circle-alert') + ' Enter an email address like name@example.com.'; $('#resEmail').setAttribute('aria-invalid', 'true');
        res.classList.remove('shake'); void res.offsetWidth; if (motionOK) res.classList.add('shake'); $('#resEmail').focus(); return;
      }
      $('#resEmail').removeAttribute('aria-invalid'); busy(b, true, 'Sending…');
      fetch(API + 'checklist_signups', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, HEADERS), body: JSON.stringify({ email: em }) })
        .then(function (r) { if (!r.ok) throw 0; res.reset(); m.innerHTML = icon('circle-check') + ' Thanks. We’ll email the checklist to ' + esc(em) + '.'; toast.success('Request received. Check your inbox soon.'); })
        .catch(function () { m.textContent = 'Something went wrong. Please try again, or ask us on WhatsApp.'; toast.error('We couldn’t save your request. Please try again.'); })
        .then(function () { busy(b, false, 'Send it'); });
    });
  }

  // ---------- Cookie notice (essential storage only) ----------
  var cookie = $('#cookie');
  function showCookie() { if (cookie) { cookie.hidden = false; var ok = $('#cookieOk'); if (ok) ok.focus({ preventScroll: true }); } }
  if (cookie) {
    var saved = null; try { saved = JSON.parse(store(STORE.consent) || 'null'); } catch (e) { saved = null; }
    var fresh = saved && saved.at && (Date.now() - saved.at) < 365 * 864e5;
    if (!fresh) cookie.hidden = false;
    $('#cookieOk').addEventListener('click', function () {
      store(STORE.consent, JSON.stringify({ essential: true, analytics: false, at: Date.now() }));
      cookie.hidden = true;
    });
  }
  $all('[data-cookie-settings]').forEach(function (b) { b.addEventListener('click', showCookie); });

  window.OTS = { content: content, loadContent: loadContent, toast: toast, icon: icon };
})();
