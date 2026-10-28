/* Public legal pages: render the PUBLISHED version of each document from the backend. */
(function () {
  'use strict';
  var CFG = window.OTS_CONFIG || {};
  var API = CFG.supabaseUrl + '/rest/v1/';
  var HEADERS = { apikey: CFG.supabaseKey };
  var doc = document.getElementById('doc');
  var DEFAULT = 'terms-of-service';
  var cache = {};

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(d) { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return d; } }

  function render(md) {
    var html = window.marked ? window.marked.parse(md, { gfm: true, breaks: true }) : '<pre>' + esc(md) + '</pre>';
    html = window.DOMPurify ? window.DOMPurify.sanitize(html) : esc(md);
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    tmp.querySelectorAll('table').forEach(function (t) { var w = document.createElement('div'); w.className = 'table-scroll'; t.parentNode.insertBefore(w, t); w.appendChild(t); });
    tmp.querySelectorAll('a[href^="http"]').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
    return tmp.innerHTML;
  }

  function show(slug, title, row) {
    document.querySelectorAll('#legalNav a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + slug) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = (title || 'Policies') + ' | Orange Therapeutic Services';
    if (!row) {
      doc.innerHTML = '<h1>' + esc(title || 'Policy') + '</h1>' +
        '<div class="doc-state"><strong>This document is being finalised.</strong>' +
        '<p class="muted">It is under professional review and will be published here shortly. If you need a copy now, or have a question about how we handle information, please <a href="./#contact">contact us</a>.</p></div>';
      return;
    }
    var body = row.body_md.replace(/^Version [^\n]*\n+/, ''); // version line is shown in the meta bar instead
    doc.innerHTML = '<h1>' + esc(row.title) + '</h1>' +
      '<div class="meta"><span>Version ' + esc(row.version) + '</span>' +
      (row.effective_date ? '<span>Effective ' + esc(fmtDate(row.effective_date)) + '</span>' : '') +
      '</div>' + render(body);
  }

  function load() {
    var slug = (location.hash || '').replace(/^#/, '') || DEFAULT;
    if (!/^[a-z0-9-]+$/.test(slug)) slug = DEFAULT;
    var navLink = document.querySelector('#legalNav a[href="#' + slug + '"]');
    var title = navLink ? navLink.textContent : 'Policy';
    if (cache[slug] !== undefined) { show(slug, title, cache[slug]); return; }
    doc.innerHTML = '<p class="muted">Loading…</p>';
    fetch(API + 'legal_versions?select=title,version,body_md,effective_date&status=eq.published&slug=eq.' + encodeURIComponent(slug), { headers: HEADERS })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) { cache[slug] = rows[0] || null; show(slug, title, cache[slug]); })
      .catch(function () {
        doc.innerHTML = '<h1>' + esc(title) + '</h1><div class="doc-state"><strong>We couldn’t load this page.</strong><p class="muted">Check your connection and try again, or <a href="./#contact">contact us</a> for a copy.</p></div>';
      });
  }
  window.addEventListener('hashchange', function () { load(); window.scrollTo(0, 0); doc.focus({ preventScroll: true }); });
  load();
})();
