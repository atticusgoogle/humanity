/* Humanity’s Largest Group Project: stories, Google’s work, the question boxes, the index and the nav.
   The grain field behind the page lives in field.js. */
(function () {
  'use strict';

  const D = window.HLGP;
  const $ = (sel, root = document) => root.querySelector(sel);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const STORE = 'hlgp-entries-v1';

  const els = {
    topbar: $('#topbar'),
    nav: $('#nav'),
    navMenu: $('#nav-menu'),
    navAsk: $('#nav-ask'),
    heroForm: $('#entry-form'),
    askSlot: $('#ask-slot'),
    stories: $('#story-steps'),
    work: $('#work-steps'),
    index: $('#index-body'),
    letters: $('#ix-letters'),
    announce: $('#announce'),
    forget: $('#forget'),
    forgetStatus: $('#forget-status'),
  };

  /* ---------- Small helpers ---------- */
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  const slug = (s) => 'ix-' + s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const listJoin = (items, word = 'and') => {
    // ["A","B","C"] -> A, B and C  (nodes or strings)
    const out = [];
    items.forEach((it, i) => {
      if (i > 0) out.push(i === items.length - 1 ? ` ${word} ` : ', ');
      out.push(it);
    });
    return out;
  };
  // Dates follow the page's language (English) in the visitor's own English style.
  const LOCALE = /^en\b/i.test(navigator.language || '') ? navigator.language : 'en';
  const fmtDate = (d, opts) => d.toLocaleDateString(LOCALE, opts);
  const scrollBehavior = () => (reduceMotion.matches ? 'auto' : 'smooth');

  /* ---------- Where "you" are: from the time zone only, never a location prompt ---------- */
  function yourPlace() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* ignore */ }
    const city = tz.includes('/') ? tz.split('/').pop().replace(/_/g, ' ') : '';
    if (!city || /^(UTC|GMT|Etc)/i.test(tz) || /\d/.test(city)) return { where: 'Wherever you are', short: 'wherever you are', tz };
    return { where: `Somewhere on ${city} time`, short: `on ${city} time`, tz };
  }
  const YOU = yourPlace();
  D.you = YOU; // the grain field puts your grain on this time zone

  /* ---------- Stories: one person per screen, each on the map ---------- */
  function renderStories() {
    const frag = document.createDocumentFragment();
    D.authors.forEach((a, i) => {
      if (!a.story) return;
      const found = /^[,;:]/.test(a.found) ? a.found : ' ' + a.found;
      frag.append(h('div', { class: 'step', 'data-scene': `place-${i}` },
        h('div', { class: 'reads' },
          h('h3', { class: 'story-name' }, a.name,
            a.native ? h('span', { class: 'story-native', lang: a.lang }, a.native) : null),
          h('p', { class: 'story-where' }, `${a.place}, `,
            a.source ? h('a', { href: a.source, target: '_blank', rel: 'noopener', 'aria-label': `${a.year}, source` }, String(a.year)) : String(a.year)),
          h('p', { class: 'story-what' }, a.name, found))));
    });
    els.stories.replaceWith(frag);
  }

  /* ---------- Google's work: one project per screen ---------- */
  function renderWork() {
    const frag = document.createDocumentFragment();
    for (const f of D.featured || []) {
      const p = D.projects[f.id];
      if (!p) continue;
      frag.append(h('div', { class: 'step', 'data-scene': `shape-${f.shape}` },
        h('div', { class: 'reads' },
          h('h3', { class: 'work-name' }, h('a', { href: p.url, target: '_blank', rel: 'noopener' }, p.name)),
          h('p', { class: 'work-what' }, p.what),
          p.join ? h('p', { class: 'work-join' }, p.join) : null)));
    }
    els.work.replaceWith(frag);
  }

  /* ---------- Matching ---------- */
  const STOP = new Set('a an and are as at be been being but by can could did do does doing for from had has have having how i if in into is it its just me more most my no not of on or our out so some than that the their them then there these they this those to too up us very was we were what when where which who why will with would you your yours ive im id youve weve theyve dont doesnt didnt isnt arent wasnt cant wont should every each all any about around near lot lots really much many also even still ever never always seem seems seemed notice noticed noticing see seen saw think thought wonder wondering know knew like get got make made year years day days time times thing things way people one two three'.split(' '));

  const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  function stem(w) {
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(ch|sh|x|ss|z)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    return w;
  }
  const stemPhrase = (p) => norm(p).split(' ').map(stem).join(' ');

  // Precompute stemmed keys per index entry.
  const MAIN = D.index.filter((e) => e.refs);
  MAIN.forEach((e) => {
    e._keys = [...new Set([e.term, ...(e.keys || [])].map(stemPhrase))];
  });
  // A project's home term: where the index describes it (explicit, or first mention).
  const HOME = {};
  for (const [id, p] of Object.entries(D.projects)) if (p.home) HOME[id] = p.home;
  [...MAIN].sort((a, b) => a.term.localeCompare(b.term)).forEach((e) => e.refs.forEach((id) => { if (!HOME[id]) HOME[id] = e.term; }));

  function match(text) {
    const words = norm(text).split(' ').filter(Boolean);
    const stems = words.map(stem);
    const hay = ' ' + stems.join(' ') + ' ';
    const scored = [];
    for (const e of MAIN) {
      let score = 0;
      let firstAt = Infinity;
      for (const k of e._keys) {
        const at = hay.indexOf(' ' + k + ' ');
        if (at >= 0) { score += k.includes(' ') ? 3 : 2; firstAt = Math.min(firstAt, at); }
      }
      if (score) scored.push({ e, score: score + (e.weight || 0), firstAt });
    }
    scored.sort((a, b) => b.score - a.score || a.firstAt - b.firstAt);
    const entries = scored.slice(0, 3).map((s) => s.e);
    const projects = [];
    for (const e of entries) for (const id of e.refs) if (!projects.includes(id) && D.projects[id]) projects.push(id);
    // Thin result? Borrow from the matched entries' "see also" neighbours.
    if (entries.length && projects.length < 2) {
      for (const e of entries) for (const t of e.also || []) {
        const n = MAIN.find((x) => x.term === t);
        if (n) for (const id of n.refs) if (projects.length < 2 && !projects.includes(id) && D.projects[id]) projects.push(id);
      }
    }
    // A fresh term for the index, from the visitor's own words.
    const fresh = words.filter((w) => !STOP.has(w) && w.length > 2 && !/^\d+$/.test(w)).sort((a, b) => b.length - a.length)[0];
    return { entries, projects: projects.slice(0, 3), fresh: fresh ? fresh[0].toUpperCase() + fresh.slice(1) : 'Unfiled' };
  }

  const isQuestion = (t) => /\?\s*$/.test(t) || /^(who|what|why|how|when|where|which|can|could|does|do|is|are|will|would|should|did)\b/i.test(t.trim());
  window.HLGP.match = match; // handy for checking coverage from the console

  /* ---------- Storage ---------- */
  function loadEntries() {
    try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { return []; }
  }
  function saveEntries(list) {
    try { localStorage.setItem(STORE, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  const entryId = (en) => 'yours-' + en.id;

  /* ---------- Index ---------- */
  function renderIndex() {
    const mine = loadEntries();
    // Visitor entries filed under an existing term, or as a new term of their own.
    const attached = new Map();
    const freshTerms = [];
    for (const en of mine) {
      if (en.terms && en.terms.length) {
        const key = en.terms[0];
        if (!attached.has(key)) attached.set(key, []);
        attached.get(key).push(en);
      } else {
        freshTerms.push({ term: en.fresh, yours: en });
      }
    }
    const all = [...D.index, ...freshTerms].sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));

    const groups = new Map();
    for (const e of all) {
      const letter = e.term[0].toUpperCase();
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter).push(e);
    }

    const frag = document.createDocumentFragment();
    for (const [letter, entries] of groups) {
      const g = h('div', { class: 'ix-group' }, h('h3', { class: 'ix-letter', id: `ix-letter-${letter.toLowerCase()}` }, letter));
      for (const e of entries) {
        if (e.yours) { g.append(yoursSlip(e.yours, e.term)); continue; }
        if (e.see) {
          const targets = [].concat(e.see);
          g.append(h('p', { class: 'ix-entry ix-entry--see', id: slug(e.term) },
            h('span', { class: 'ix-see' }, e.term, ', ', h('i', {}, 'see'), ' ',
              listJoin(targets.map((t) => h('a', { href: '#' + slug(t) }, t))))));
          continue;
        }
        const refs = e.refs.filter((id) => D.projects[id]);
        // Each project is described once, under its home term; elsewhere it's just named.
        const entry = h('div', { class: 'ix-entry', id: slug(e.term) },
          h('h4', { class: 'ix-term' }, e.term),
          refs.map((id) => {
            const p = D.projects[id];
            const home = HOME[id] === e.term;
            return h('span', { class: home ? 'ix-ref' : 'ix-ref ix-ref--named' },
              h('a', { href: p.url, target: '_blank', rel: 'noopener' }, p.name), home ? ['. ', p.what] : '');
          }),
          e.also && e.also.length
            ? h('span', { class: 'ix-also' }, h('i', {}, 'see also'), ' ',
                listJoin(e.also.map((t) => h('a', { href: '#' + slug(t) }, t)), 'and'))
            : null);
        g.append(entry);
        for (const en of attached.get(e.term) || []) g.append(yoursSlip(en));
      }
      frag.append(g);
    }
    els.index.replaceChildren(frag);
    // The A–Z row: jump straight to a letter.
    els.letters.replaceChildren(...[...groups.keys()].map((L) =>
      h('a', { href: `#ix-letter-${L.toLowerCase()}`, 'aria-label': `Letter ${L}` }, L)));
  }

  function yoursSlip(en, ownTerm) {
    const when = fmtDate(new Date(en.date), { day: 'numeric', month: 'short' });
    return h('div', { class: 'ix-yours', id: entryId(en) },
      ownTerm ? h('h4', { class: 'ix-term' }, ownTerm, ' ') : null,
      h('q', {}, en.text),
      h('span', { class: 'ix-meta' },
        `You, ${YOU.short}, ${when}.`,
        en.terms && en.terms.length > 1
          ? [' ', h('i', {}, 'See also'), ' ', listJoin(en.terms.slice(1).map((t) => h('a', { href: '#' + slug(t) }, t))), '.']
          : ''));
  }

  function flash(el) {
    if (!el || !el.matches('.ix-entry, .ix-yours')) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 1600);
  }

  /* ---------- Question boxes: one in the hero, one at "Your turn" ---------- */
  const forms = [];

  function makeForms() {
    const second = els.heroForm.cloneNode(true);
    second.id = 'entry-form-2';
    $('textarea', second).id = 'entry-2';
    $('label', second).setAttribute('for', 'entry-2');
    els.askSlot.append(second);
    [els.heroForm, second].forEach(wireForm);
  }

  function wireForm(form) {
    const f = {
      form,
      slip: $('.slip', form),
      entry: $('textarea', form),
      add: $('button[type="submit"]', form),
      result: $('.result', form),
      resultInner: $('.result-inner', form),
      status: $('.form-status', form),
      examples: $('.examples', form),
    };
    forms.push(f);
    renderExamples(f);
    form.addEventListener('submit', (e) => submit(e, f));
    f.entry.addEventListener('input', () => { autosize(f); setWaiting(f); if (f.status.textContent) f.status.textContent = ''; });
    f.entry.addEventListener('focus', () => setWaiting(f));
    f.entry.addEventListener('blur', () => setWaiting(f));
    f.entry.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    autosize(f);
    setWaiting(f);
  }

  function autosize(f) {
    f.entry.style.height = 'auto';
    f.entry.style.height = Math.min(f.entry.scrollHeight, 240) + 'px';
    f.entry.style.overflowY = f.entry.scrollHeight > 240 ? 'auto' : 'hidden';
  }
  function setWaiting(f) {
    const waiting = !f.entry.value && document.activeElement !== f.entry && !f.entry.readOnly;
    f.slip.classList.toggle('is-waiting', waiting);
  }

  function renderExamples(f) {
    const n = D.examples.length;
    const items = D.examples.map((x, i) => {
      const btn = h('button', { type: 'button', class: 'example', 'aria-label': `Try: ${x.text}`, onclick: () => {
        if (f.entry.readOnly) resetEntry(f);
        f.entry.value = x.text;
        autosize(f);
        setWaiting(f);
        f.entry.focus();
      } }, x.label);
      // Keep each example's trailing punctuation on its line.
      const tail = i < n - 2 ? ',' : i === n - 1 ? '.' : '';
      return h('span', { class: 'example-item' }, btn, tail);
    });
    const out = ['Try '];
    items.forEach((it, i) => {
      if (i > 0) out.push(i === n - 1 ? ' or ' : ' ');
      out.push(it);
    });
    f.examples.replaceChildren(...out);
  }

  function resetEntry(f) {
    f.entry.readOnly = false;
    f.entry.value = '';
    f.add.hidden = false;
    f.result.classList.remove('is-open');
    setTimeout(() => { if (!f.result.classList.contains('is-open')) f.resultInner.replaceChildren(); }, 600);
    f.status.textContent = '';
    autosize(f);
    setWaiting(f);
  }

  function submit(ev, f) {
    ev.preventDefault();
    const text = f.entry.value.replace(/\s+/g, ' ').trim();
    if (!text) {
      f.status.textContent = 'Type a question or something you’ve noticed first.';
      f.entry.focus();
      return;
    }
    if (text.length < 4) {
      f.status.textContent = 'Add a few more words so it can be indexed.';
      f.entry.focus();
      return;
    }
    f.status.textContent = '';
    const m = match(text);
    const kind = isQuestion(text) ? 'question' : 'observation';
    const en = {
      id: Date.now().toString(36),
      text,
      kind,
      terms: m.entries.map((e) => e.term),
      fresh: m.entries.length ? null : m.fresh,
      date: new Date().toISOString(),
    };
    const list = loadEntries();
    list.push(en);
    const saved = saveEntries(list);

    renderIndex();
    showResult(f, en, m, saved);

    f.entry.readOnly = true;
    f.add.hidden = true;
    setWaiting(f);
    syncForget();
  }

  function showResult(f, en, m, saved) {
    const termLinks = en.terms.length
      ? listJoin(en.terms.map((t) => h('a', { href: '#' + slug(t) }, t)))
      : [h('a', { href: '#' + entryId(en) }, en.fresh)];

    const filed = h('p', { class: 'result-filed' },
      en.terms.length
        ? [`Added. Your ${en.kind} is indexed under `, ...termLinks, '.']
        : [`Added. Nothing in the index matches your ${en.kind} yet, so it starts a new entry: `, ...termLinks, '.']);

    const ids = m.projects.length ? m.projects : D.fallback;
    const refs = h('ul', { class: 'refs' }, ids.map((id) => {
      const p = D.projects[id];
      return h('li', { class: 'ref' },
        h('a', { class: 'ref-name', href: p.url, target: '_blank', rel: 'noopener' }, p.name),
        h('p', { class: 'ref-what' }, p.what),
        p.join ? h('p', { class: 'ref-join' }, p.join) : null);
    }));

    const note = h('p', { class: 'result-note', role: 'status' },
      saved ? '' : 'This browser isn’t saving entries, so this one will be gone when you leave.');

    const body = h('div', { class: 'result-body' },
      filed,
      h('h3', { class: 'result-h' }, m.projects.length ? 'Already underway at Google' : 'Tools to dig in with'),
      refs,
      h('div', { class: 'result-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => askGemini(f, en.text) }, 'Ask Gemini about it'),
        h('button', { class: 'btn btn--quiet', type: 'button', onclick: () => { resetEntry(f); f.entry.focus(); } }, 'Add another'),
        note));

    f.resultInner.replaceChildren(body);
    els.announce.textContent = `${filed.textContent} ${ids.length} related ${ids.length === 1 ? 'project' : 'projects'} below.`;
    requestAnimationFrame(() => {
      f.result.classList.add('is-open');
      f.result.focus({ preventScroll: true });
      // A ripple goes out through the grains from the slip: your entry joined the project.
      const r = f.slip.getBoundingClientRect();
      if (D.field) D.field.burst(r.left + r.width / 2, r.top + 32);
      setTimeout(() => {
        const s = f.slip.getBoundingClientRect();
        if (s.bottom > window.innerHeight - 16) {
          window.scrollBy({ top: Math.min(s.bottom - window.innerHeight + 32, s.top - 80), behavior: scrollBehavior() });
        }
      }, reduceMotion.matches ? 0 : 560);
    });
  }

  function askGemini(f, text) {
    const note = $('.result-note', f.form);
    // Start the copy and open the tab inside the same click, so neither is blocked.
    const copying = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(text).then(() => true, () => false)
      : Promise.resolve(false);
    window.open(D.gemini.url(text), '_blank', 'noopener');
    copying.then((copied) => {
      if (!note) return;
      note.textContent = D.gemini.prefills
        ? 'Opened Gemini in a new tab.'
        : copied ? 'Copied your words and opened Gemini in a new tab. Paste them in to start.' : 'Opened Gemini in a new tab.';
    });
  }

  // The question box nearest the middle of the screen.
  function nearestForm() {
    let best = forms[0], bd = Infinity;
    for (const f of forms) {
      const r = f.slip.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }
  function goToForm(f) {
    if (f.entry.readOnly) resetEntry(f);
    f.slip.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    f.entry.focus({ preventScroll: true });
  }

  /* ---------- Navigation ---------- */
  function wireNav() {
    const links = [...document.querySelectorAll('[data-nav]')];
    // Which nav item each part of the page belongs to.
    const owner = { how: 'how', why: 'how', stories: 'stories', work: 'work', index: 'index' };
    const sections = Object.keys(owner).map((id) => document.getElementById(id)).filter(Boolean);
    let ticking = false;
    const update = () => {
      ticking = false;
      const line = window.innerHeight * 0.45;
      let current = null;
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) current = owner[s.id];
      }
      for (const a of links) {
        if (a.dataset.nav === current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      }
      els.topbar.classList.toggle('is-solid', window.scrollY > 24);
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();

    // Phones: the links fold into a menu.
    const setMenu = (open) => {
      els.navMenu.setAttribute('aria-expanded', String(open));
      els.navMenu.textContent = open ? 'Close' : 'Menu';
      els.nav.classList.toggle('is-open', open);
      els.topbar.classList.toggle('is-open', open);
    };
    els.navMenu.addEventListener('click', () => setMenu(els.navMenu.getAttribute('aria-expanded') !== 'true'));
    els.nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.nav.classList.contains('is-open')) { setMenu(false); els.navMenu.focus(); }
    });
    window.matchMedia('(min-width: 721px)').addEventListener('change', () => setMenu(false));
  }

  /* ---------- Wiring ---------- */
  function wire() {
    // Links to a question box put you in it. Index and note links mark the spot they land on.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      if (id === 'entry') { e.preventDefault(); goToForm(a === els.navAsk ? nearestForm() : forms[0]); return; }
      if (a.hasAttribute('data-ask')) { e.preventDefault(); goToForm(forms[1] || forms[0]); return; }
      const target = document.getElementById(id);
      if (target) setTimeout(() => flash(target), reduceMotion.matches ? 0 : 450);
    });

    els.forget.addEventListener('click', () => {
      const had = loadEntries().length;
      try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
      renderIndex();
      forms.forEach(resetEntry);
      els.forgetStatus.textContent = had ? 'Removed what you added.' : 'Nothing to remove yet.';
      syncForget();
    });
  }

  function syncForget() {
    els.forget.disabled = loadEntries().length === 0;
  }

  /* ---------- Go ---------- */
  renderStories();
  renderWork();
  makeForms();
  renderIndex();
  wireNav();
  wire();
  syncForget();
})();
