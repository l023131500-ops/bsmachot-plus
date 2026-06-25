(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

  let DATA = null;
  let SHEETS = [];
  const SLIDE_COUNT = 25;
  let currentIdx = 0;

  // short descriptions per sheet (by keyword in title)
  const SHEET_DESC = [
    [/מבוא/, 'תקציר התוכנית, תוכן עניינים והמדדים המרכזיים של שמחות פלוס.'],
    [/מתחרים/, 'ניתוח מעמיק של פתרונות המתנות הדיגיטליות, RSVP והעמדות בישראל — כולל יתרונות, חסרונות ופערים.'],
    [/אולמות - רשימה/, 'מיפוי ארצי של אולמות אירועים לפי אזור וקטגוריה, עם סינון וחיפוש חי.'],
    [/נתוני שוק/, 'גודל השוק, טרנדים והזדמנויות בענף האירועים והמתנות הדיגיטליות.'],
    [/מגזרים/, 'פילוח לפי מגזר ותת-מגזר: סכומי מתנות אופייניים, יתרון העמדה והחבילה בסגירת אולם.'],
    [/סקר לקוחות/, 'שאלות, תובנות וממצאים מצד הלקוחות והאורחים.'],
    [/אולמות B2B/, 'שאלות וממצאים מצד בעלי האולמות — מה חשוב להם ואיך זה מתחבר להצעה.'],
    [/תוכנית עסקית/, 'הנחות יסוד, מודל ההכנסות B2B2C ויחידות הכלכלה של המיזם.'],
    [/רווח והפסד/, 'מטריצות רווחיות חיות ותחזית רב-שנתית לפי מספר עמדות ומחזור סליקה.'],
    [/ניתוח עמדה/, 'רגישות הרווחיות לפי מחזור סליקה ומספר אירועים לעמדה.'],
    [/תחזית 7/, 'תחזית פיננסית מלאה לשנים 2025–2031 על בסיס נוסחאות.'],
    [/רעיונות/, 'מפת חדשנות ורעיונות להתקדמות בתחום האירועים לפי תעדוף.'],
    [/ממשק/, 'חוויית משתמש לאולמות ולאירועים, כולל הרחבות לדינרים, תערוכות ועמדת תצוגה.'],
    [/תוכנית עבודה/, 'מפת דרכים (Roadmap) רבעונית ורב-שנתית לביצוע.'],
    [/מקורות/, 'רשימת המקורות הציבוריים שעליהם מבוססים הנתונים.'],
  ];
  function sheetDesc(title) {
    const m = SHEET_DESC.find(([rx]) => rx.test(title));
    return m ? m[1] : '';
  }
  function makeHero(eyebrow, title, desc, chipHtml) {
    const h = el('header', 'view-hero');
    h.innerHTML = `<div class="vh-eyebrow">${esc(eyebrow)}</div><h2>${esc(title)}</h2>` +
      (desc ? `<p>${esc(desc)}</p>` : '') + (chipHtml || '');
    return h;
  }

  // ---- helpers ----
  const isEmptyRow = (r) => !r || r.every(c => c === '' || c == null);
  // strip leading empty col(s)
  const trim = (r) => { const a = (r || []).slice(); while (a.length && (a[0] === '' || a[0] == null)) a.shift(); return a; };
  const isNum = (v) => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(v.replace(/[,₪%]/g, '')) && /\d/.test(v));
  const fmt = (v) => {
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return v.toLocaleString('he-IL');
      return v.toLocaleString('he-IL', { maximumFractionDigits: 2 });
    }
    return v;
  };
  const looksUrl = (v) => typeof v === 'string' && /^https?:\/\//.test(v.trim());
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // count non-empty cells in trimmed row
  const cellCount = (r) => trim(r).filter(c => c !== '' && c != null).length;

  // ---- navigation ----
  function buildNav() {
    const nav = $('#nav');
    nav.innerHTML = '';
    SHEETS.forEach((s, i) => {
      const m = s.title.match(/^(\p{Emoji}+)\s*(.*)$/u);
      const ico = m ? m[1] : '•';
      const label = m ? m[2] : s.title;
      const b = el('button', '', `<span class="nav-ico" aria-hidden="true">${ico}</span><span>${esc(label)}</span>`);
      b.addEventListener('click', () => { location.hash = '#sheet/' + i; closeSidebar(); });
      b.dataset.idx = i;
      nav.appendChild(b);
    });
    // slides entry
    const sb = el('button', '', `<span class="nav-ico" aria-hidden="true">🎞️</span><span>מצגת — ${SLIDE_COUNT} שקפים</span>`);
    sb.addEventListener('click', () => { location.hash = '#slides'; closeSidebar(); });
    sb.dataset.slides = '1';
    nav.appendChild(sb);
  }
  function markActive(key) {
    document.querySelectorAll('#nav button').forEach(b => {
      const isS = b.dataset.slides === '1';
      b.classList.toggle('active', (key === 'slides' && isS) || (b.dataset.idx === String(key)));
    });
  }

  // ---- sheet rendering ----
  // Detect table blocks: a header row (multi-cell, mostly text) followed by data rows.
  function renderSheet(idx) {
    const sheet = SHEETS[idx];
    const view = $('#view');
    view.innerHTML = '';
    const titleClean = sheet.title.replace(/^\p{Emoji}+\s*/u, '');
    $('#pageTitle').textContent = titleClean;
    $('#searchWrap').hidden = true;

    // venue sheet special handling
    if (/אולמות - רשימה/.test(sheet.title)) { renderVenues(sheet, view); return; }

    view.className = 'anim';
    view.appendChild(makeHero('שמחות פלוס · תוכנית עסקית', titleClean, sheetDesc(sheet.title)));

    const rows = sheet.grid;
    let i = 0;
    let firstTitleUsed = false;
    while (i < rows.length) {
      const r = rows[i];
      if (isEmptyRow(r)) { i++; continue; }
      const cells = trim(r);
      const cc = cellCount(r);

      // single-cell row => title or note
      if (cc === 1) {
        const txt = cells.find(c => c !== '' && c != null);
        // first single-cell is the doc title (skip, shown in topbar); long ones => note
        if (!firstTitleUsed) { firstTitleUsed = true; i++; continue; }
        if (String(txt).length > 70 || /נדרים|מבוסס|נוסחאות|הערה|כל הת/.test(String(txt))) {
          view.appendChild(el('p', 'note', esc(txt)));
        } else {
          view.appendChild(el('h2', 'section-h', esc(txt)));
        }
        i++; continue;
      }

      // multi-cell: gather a contiguous block of multi-cell rows => table
      const block = [];
      while (i < rows.length && !isEmptyRow(rows[i]) && cellCount(rows[i]) >= 2) {
        block.push(trim(rows[i]));
        i++;
      }
      renderTableBlock(block, view);
    }
    window.scrollTo(0, 0);
    $('#main').scrollTop = 0;
  }

  function renderTableBlock(block, view) {
    if (!block.length) return;
    // normalize width
    const w = Math.max(...block.map(r => r.length));
    block.forEach(r => { while (r.length < w) r.push(''); });

    // header = first row if it has no numbers (all labels) OR few numbers
    const head = block[0];
    const headIsLabels = head.filter(c => isNum(c)).length <= 1 && head.some(c => c !== '');
    let header = null, body = block;
    if (headIsLabels && block.length > 1) { header = head; body = block.slice(1); }

    const card = el('div', 'table-card');
    const scroll = el('div', 'table-scroll');
    const table = el('table');

    if (header) {
      const thead = el('thead');
      const tr = el('tr');
      header.forEach(c => tr.appendChild(el('th', '', esc(c))));
      thead.appendChild(tr); table.appendChild(thead);
    }
    const tbody = el('tbody');
    body.forEach(r => {
      const tr = el('tr');
      // emphasize total/sum-ish rows
      const firstTxt = String(r[0] || '');
      if (/סה"כ|סהכ|רווח נקי|EBITDA|break|נקודת/i.test(firstTxt)) tr.className = 'row-emph';
      r.forEach((c) => {
        const num = isNum(c) && typeof c !== 'string' ? true : (isNum(c) && /^[\d.,₪%\- ]+$/.test(String(c)));
        const td = el('td', num ? 'num' : '');
        if (looksUrl(c)) td.innerHTML = `<a href="${esc(c)}" target="_blank" rel="noopener noreferrer">קישור ↗</a>`;
        else td.innerHTML = esc(fmt(c));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table); card.appendChild(scroll);
    view.appendChild(card);
  }

  // ---- venues ----
  let VENUE_HEADER = [], VENUE_ROWS = [], venueFilter = 'all', venueQuery = '';
  function renderVenues(sheet, view) {
    // find header row (contains 'שם המקום')
    const rows = sheet.grid.map(trim);
    let hIdx = rows.findIndex(r => r.some(c => /שם המקום/.test(String(c))));
    VENUE_HEADER = rows[hIdx];
    VENUE_ROWS = rows.slice(hIdx + 1).filter(r => r.some(c => c !== '' && c != null) && r.length > 2);

    $('#searchWrap').hidden = false;
    const search = $('#tableSearch');
    search.value = '';
    venueQuery = ''; venueFilter = 'all';

    // KPIs
    const total = VENUE_ROWS.length;
    const withPhone = VENUE_ROWS.filter(r => String(r[8] || '').trim() && /\d/.test(String(r[8]))).length;
    const catIdx = VENUE_HEADER.findIndex(c => /קטגוריה/.test(String(c)));
    const regionIdx = VENUE_HEADER.findIndex(c => /אזור/.test(String(c)));
    const cats = {}; const regions = {};
    VENUE_ROWS.forEach(r => {
      const cv = String(r[catIdx] || '').trim(); if (cv) cats[cv] = (cats[cv] || 0) + 1;
      const rv = String(r[regionIdx] || '').trim(); if (rv) regions[rv] = (regions[rv] || 0) + 1;
    });

    view.className = 'anim';
    view.appendChild(makeHero('מיפוי ארצי', 'רשימת האולמות',
      'מיפוי ארצי של אולמות אירועים, גני אירועים, אולמות בוטיק ומקומות מיוחדים — לפי אזור וקטגוריה. ניתן לסנן לפי קטגוריה ולחפש לפי שם, עיר או אזור.',
      `<div class="vh-chip">📍 <b>${total.toLocaleString('he-IL')}</b> אולמות ב${Object.keys(regions).length} אזורים</div>`));

    const kpis = el('div', 'kpi-grid');
    [['🏛️', total, 'אולמות במאגר'], ['📂', Object.keys(cats).length, 'קטגוריות'], ['🗺️', Object.keys(regions).length, 'אזורים בארץ'], ['📞', withPhone, 'עם טלפון ליצירת קשר']]
      .forEach(([ico, v, l]) => kpis.appendChild(el('div', 'kpi', `<div class="k-ico">${ico}</div><div class="k-val">${v.toLocaleString('he-IL')}</div><div class="k-label">${l}</div>`)));
    view.appendChild(kpis);

    // filter chips by category
    const fwrap = el('div', 'filters');
    const allChip = el('button', 'chip active', `הכל (${total})`);
    allChip.dataset.cat = 'all';
    fwrap.appendChild(allChip);
    Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
      const chip = el('button', 'chip', `${esc(c)} (${n})`);
      chip.dataset.cat = c; fwrap.appendChild(chip);
    });
    fwrap.addEventListener('click', e => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      venueFilter = chip.dataset.cat;
      fwrap.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
      drawVenueTable();
    });
    view.appendChild(fwrap);

    // table container
    const host = el('div'); host.id = 'venueTableHost';
    view.appendChild(host);

    search.oninput = () => { venueQuery = search.value.trim(); drawVenueTable(); };
    drawVenueTable();
    window.scrollTo(0, 0); $('#main').scrollTop = 0;
  }

  function venueBadge(v) {
    const t = String(v || '').trim();
    if (/גבוה/.test(t)) return `<span class="badge b-high">${esc(t)}</span>`;
    if (/בינוני/.test(t)) return `<span class="badge b-mid">${esc(t)}</span>`;
    if (t) return `<span class="badge b-low">${esc(t)}</span>`;
    return '';
  }

  function drawVenueTable() {
    const host = $('#venueTableHost'); if (!host) return;
    const catIdx = VENUE_HEADER.findIndex(c => /קטגוריה/.test(String(c)));
    const prioIdx = VENUE_HEADER.length - 1;
    const linkIdx = VENUE_HEADER.findIndex(c => /קישור|מקור/.test(String(c)));
    const q = venueQuery.toLowerCase();

    let rows = VENUE_ROWS.filter(r => {
      if (venueFilter !== 'all' && String(r[catIdx] || '').trim() !== venueFilter) return false;
      if (q) return r.some(c => String(c || '').toLowerCase().includes(q));
      return true;
    });

    const card = el('div', 'table-card');
    const scroll = el('div', 'table-scroll');
    const table = el('table');
    const thead = el('thead'); const htr = el('tr');
    VENUE_HEADER.forEach(c => htr.appendChild(el('th', '', esc(c))));
    thead.appendChild(htr); table.appendChild(thead);
    const tbody = el('tbody');

    if (!rows.length) {
      const tr = el('tr');
      const td = el('td'); td.colSpan = VENUE_HEADER.length; td.innerHTML = '<div class="empty">לא נמצאו אולמות התואמים את החיפוש.</div>';
      tr.appendChild(td); tbody.appendChild(tr);
    } else {
      rows.forEach(r => {
        const tr = el('tr');
        r.forEach((c, ci) => {
          const td = el('td');
          if (ci === prioIdx) td.innerHTML = venueBadge(c);
          else if (ci === linkIdx && looksUrl(c)) td.innerHTML = `<a href="${esc(c)}" target="_blank" rel="noopener noreferrer">מקור ↗</a>`;
          else if (ci === 0) { td.className = 'num'; td.textContent = fmt(c); }
          else td.textContent = fmt(c);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody); scroll.appendChild(table); card.appendChild(scroll);
    const meta = el('div', 'table-meta', `<span>מציג ${rows.length.toLocaleString('he-IL')} מתוך ${VENUE_ROWS.length.toLocaleString('he-IL')} אולמות</span>`);
    card.appendChild(meta);
    host.innerHTML = ''; host.appendChild(card);
  }

  // ---- slides ----
  const SLIDE_TITLES = ['שער','הבעיה','הפתרון','גודל השוק','טרנדים','סקר לקוחות','סקר אולמות B2B','ניתוח תחרותי','Mazalit ומודול חרדי','מודל הכנסות','Unit Economics','ניתוח תרחישים','רווח והפסד','תחזית 7 שנים','השקעה ועלויות','הצעת ערך לאולמות','Go-To-Market','Roadmap מוצר','תוכנית עבודה','סיכונים','מדדי פיילוט','מיפוי 342 אולמות','סכומי מתנות לפי מגזר','חדשנות וממשק','סיכום'];
  function renderSlides() {
    const view = $('#view');
    $('#pageTitle').textContent = 'מצגת המשקיעים';
    $('#searchWrap').hidden = true;
    view.innerHTML = '';
    view.className = 'anim';
    view.appendChild(makeHero('מצגת המשקיעים', 'מצגת שמחות פלוס',
      'מצגת התוכן המלאה של שמחות פלוס — לחצו על כל שקף להגדלה ולגלישה בין השקפים.',
      `<div class="vh-chip">🎞️ <b>${SLIDE_COUNT}</b> שקפים</div>`));
    const grid = el('div', 'slides-grid');
    for (let n = 1; n <= SLIDE_COUNT; n++) {
      const file = `./assets/slides/slide-${String(n).padStart(2, '0')}.png`;
      const cap = SLIDE_TITLES[n - 1] || `שקף ${n}`;
      const card = el('div', 'slide-thumb');
      card.innerHTML = `<img loading="lazy" src="${file}" alt="שקף ${n}: ${esc(cap)}"><div class="st-cap"><span>${esc(cap)}</span><b>${n}</b></div>`;
      card.addEventListener('click', () => openLightbox(n));
      grid.appendChild(card);
    }
    view.appendChild(grid);
    window.scrollTo(0, 0); $('#main').scrollTop = 0;
  }

  // lightbox
  let lb = null;
  function ensureLightbox() {
    if (lb) return lb;
    lb = el('div', 'lightbox');
    lb.innerHTML = `
      <button class="lb-close" aria-label="סגור">✕</button>
      <img id="lbImg" alt="">
      <div class="lb-bar">
        <button id="lbNext" aria-label="הבא">‹</button>
        <span class="lb-count" id="lbCount"></span>
        <button id="lbPrev" aria-label="הקודם">›</button>
      </div>`;
    document.body.appendChild(lb);
    lb.querySelector('.lb-close').onclick = closeLightbox;
    lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
    // RTL: prev is on the right (›), next on the left (‹)
    $('#lbPrev').onclick = () => stepSlide(-1);
    $('#lbNext').onclick = () => stepSlide(1);
    return lb;
  }
  function openLightbox(n) {
    ensureLightbox(); currentIdx = n;
    updateLightbox(); lb.classList.add('open');
    document.addEventListener('keydown', lbKeys);
  }
  function updateLightbox() {
    $('#lbImg').src = `./assets/slides/slide-${String(currentIdx).padStart(2, '0')}.png`;
    $('#lbImg').alt = `שקף ${currentIdx}: ${SLIDE_TITLES[currentIdx - 1] || ''}`;
    $('#lbCount').textContent = `שקף ${currentIdx} מתוך ${SLIDE_COUNT}`;
  }
  function stepSlide(d) { currentIdx = ((currentIdx - 1 + d + SLIDE_COUNT) % SLIDE_COUNT) + 1; updateLightbox(); }
  function closeLightbox() { if (lb) lb.classList.remove('open'); document.removeEventListener('keydown', lbKeys); }
  function lbKeys(e) {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') stepSlide(1);   // visual next (RTL)
    else if (e.key === 'ArrowRight') stepSlide(-1);
  }

  // ---- routing ----
  function route() {
    const h = location.hash || '#sheet/0';
    if (h === '#slides') { renderSlides(); markActive('slides'); return; }
    const m = h.match(/#sheet\/(\d+)/);
    const idx = m ? Math.min(+m[1], SHEETS.length - 1) : 0;
    renderSheet(idx); markActive(idx);
  }

  // ---- sidebar (mobile) ----
  function openSidebar() { $('#sidebar').classList.add('open'); $('#scrim').hidden = false; $('#menuBtn').setAttribute('aria-expanded', 'true'); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); }

  // ---- theme ----
  function initTheme() {
    let t = 'light';
    try { t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) {}
    document.documentElement.dataset.theme = t;
    $('#themeBtn').addEventListener('click', () => {
      document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    });
  }

  // ---- init ----
  async function init() {
    initTheme();
    $('#menuBtn').addEventListener('click', openSidebar);
    $('#scrim').addEventListener('click', closeSidebar);
    try {
      const res = await fetch('./assets/data.json');
      DATA = await res.json();
      SHEETS = DATA.sheets || [];
    } catch (e) {
      $('#view').innerHTML = '<p class="empty">שגיאה בטעינת הנתונים.</p>';
      return;
    }
    buildNav();
    window.addEventListener('hashchange', route);
    route();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
