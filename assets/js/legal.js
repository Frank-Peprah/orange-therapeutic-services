/* Public legal pages: render the PUBLISHED version of each document from the backend,
   with breadcrumbs, an "On this page" contents list, previous/next links and print. */
(function () {
  'use strict';
  var CFG = window.OTS_CONFIG || {};
  var API = CFG.supabaseUrl + '/rest/v1/';
  var HEADERS = { apikey: CFG.supabaseKey };
  var doc = document.getElementById('doc');
  var DEFAULT = 'terms-of-service';
  var cache = {};
  var icon = (window.OTS && window.OTS.icon) || function () { return ''; };
  var motionOK = !window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('#legalNav a'));

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(d) { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return d; } }
  function slugify(t, i) { return 'sec-' + (i + 1) + '-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }

  function render(md) {
    var html = window.marked ? window.marked.parse(md, { gfm: true, breaks: true }) : '<pre>' + esc(md) + '</pre>';
    html = window.DOMPurify ? window.DOMPurify.sanitize(html) : esc(md);
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    tmp.querySelectorAll('table').forEach(function (t) { var w = document.createElement('div'); w.className = 'table-scroll'; t.parentNode.insertBefore(w, t); w.appendChild(t); });
    tmp.querySelectorAll('a[href^="http"]').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
    var heads = tmp.querySelectorAll('h2'), toc = '';
    if (heads.length > 2) {
      toc = '<details class="toc" open><summary>' + icon('list') + ' On this page</summary><ol>';
      heads.forEach(function (h, i) { h.id = slugify(h.textContent, i); toc += '<li><a href="#" data-jump="' + h.id + '">' + esc(h.textContent) + '</a></li>'; });
      toc += '</ol></details>';
    }
    return { body: tmp.innerHTML, toc: toc };
  }
  function pager(slug) {
    var i = navLinks.findIndex(function (a) { return a.getAttribute('href') === '#' + slug; });
    var prev = navLinks[i - 1], next = navLinks[i + 1], h = '<nav class="doc-pager" aria-label="More policies">';
    if (prev) h += '<a href="' + prev.getAttribute('href') + '"><small>' + icon('arrow-left') + ' Previous</small><strong>' + esc(prev.textContent.trim()) + '</strong></a>';
    if (next) h += '<a class="next" href="' + next.getAttribute('href') + '"><small>Next ' + icon('arrow-right') + '</small><strong>' + esc(next.textContent.trim()) + '</strong></a>';
    return h + '</nav>';
  }
  function crumbs(title) {
    return '<nav class="crumbs" aria-label="Breadcrumb"><a href="./">Home</a>' + icon('chevron-right') + '<span>Policies</span>' + icon('chevron-right') + '<span aria-current="page">' + esc(title) + '</span></nav>';
  }
  function paint(html) {
    var go = function () { doc.innerHTML = html; doc.classList.remove('doc-in'); void doc.offsetWidth; doc.classList.add('doc-in'); };
    if (motionOK && document.startViewTransition) document.startViewTransition(go); else go();
  }
  function show(slug, title, row) {
    navLinks.forEach(function (a) { if (a.getAttribute('href') === '#' + slug) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.title = (title || 'Policies') + ' | Orange Therapeutic Services';
    if (!row) {
      paint(crumbs(title) + '<h1>' + esc(title || 'Policy') + '</h1>' +
        '<div class="doc-state"><strong>' + icon('clock') + ' This document is being finalised.</strong>' +
        '<p class="muted">It is under professional review and will be published here shortly. If you need a copy now, or have a question about how we handle information, please <a href="./#contact">contact us</a>.</p></div>' + pager(slug));
      return;
    }
    var body = row.body_md.replace(/^Version [^\n]*\n+/, '');
    var r = render(body);
    paint(crumbs(row.title) + '<h1>' + esc(row.title) + '</h1>' +
      '<div class="meta"><span>' + icon('file-text') + ' Version ' + esc(row.version) + '</span>' +
      (row.effective_date ? '<span>' + icon('calendar') + ' Effective ' + esc(fmtDate(row.effective_date)) + '</span>' : '') + '</div>' +
      '<div class="doc-tools"><button type="button" class="copy" data-print>' + icon('printer') + ' Print or save as PDF</button><button type="button" class="copy" data-share>' + icon('copy') + ' Copy link</button></div>' +
      r.toc + r.body + pager(slug));
  }
  doc.addEventListener('click', function (e) {
    var j = e.target.closest('[data-jump]');
    if (j) { e.preventDefault(); var t = document.getElementById(j.dataset.jump); if (t) { t.setAttribute('tabindex', '-1'); t.scrollIntoView({ behavior: motionOK ? 'smooth' : 'auto' }); t.focus({ preventScroll: true }); } return; }
    if (e.target.closest('[data-print]')) { window.print(); return; }
    if (e.target.closest('[data-share]')) {
      var url = location.href;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { window.OTS_TOAST && window.OTS_TOAST.success('Link copied'); }, function () { window.OTS_TOAST && window.OTS_TOAST.info(url); });
    }
  });

  function load() {
    var slug = (location.hash || '').replace(/^#/, '') || DEFAULT;
    if (!/^[a-z0-9-]+$/.test(slug) || !document.querySelector('#legalNav a[href="#' + slug + '"]')) slug = DEFAULT;
    var navLink = document.querySelector('#legalNav a[href="#' + slug + '"]');
    var title = navLink ? navLink.textContent.trim() : 'Policy';
    if (cache[slug] !== undefined) { show(slug, title, cache[slug]); return; }
    fetch(API + 'legal_versions?select=title,version,body_md,effective_date&status=eq.published&slug=eq.' + encodeURIComponent(slug), { headers: HEADERS })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) { cache[slug] = rows[0] || null; show(slug, title, cache[slug]); })
      .catch(function () {
        paint(crumbs(title) + '<h1>' + esc(title) + '</h1><div class="doc-state"><strong>We couldn’t load this page.</strong><p class="muted">Check your connection and try again, or <a href="./#contact">contact us</a> for a copy.</p></div>');
      });
  }
  window.addEventListener('hashchange', function () {
    if (!/^#[a-z0-9-]+$/.test(location.hash) || /^#sec-/.test(location.hash)) return;
    load(); window.scrollTo({ top: 0, behavior: motionOK ? 'smooth' : 'auto' }); doc.focus({ preventScroll: true });
  });
  load();
})();
