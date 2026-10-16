(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const base = new URL('./', document.baseURI);
  const storageKey = `bible-studies:${base.pathname}:v1`;
  const views = ['library-view', 'study-view', 'error-view'];
  const esvApiBase = window.BIBLE_STUDY_CONFIG?.esvApiBase || '';
  const names = {read: 'Reading', discuss: 'Discussion'};
  const state = {catalog: [], study: null, entry: null, section: '', focus: 'read', open: ['read'], hostOpen: false, together: false, preferences: {progress: {}}, esv: {study: '', readings: null, loading: false, error: ''}};
  let requestNumber = 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const current = () => state.study.steps.find(step => step.id === state.section);
  const firstSection = study => study.steps[0].id;

  function localURL(path) {
    const url = new URL(path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error('A study file has an invalid address.');
    return url;
  }

  function displayDate(date) {
    return new Intl.DateTimeFormat('en-US', {month: 'long', day: 'numeric', year: 'numeric'}).format(new Date(`${date}T12:00:00`));
  }

  function loadPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved === 'object') {
        if (saved.progress && typeof saved.progress === 'object' && !Array.isArray(saved.progress)) state.preferences.progress = saved.progress;
      }
    } catch {
      // A damaged preference must never prevent opening a study.
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.preferences));
      $('storage-notice').hidden = true;
    } catch {
      $('storage-notice').hidden = false;
    }
  }

  async function readJSON(path) {
    const response = await fetch(localURL(path), {cache: 'no-cache'});
    if (!response.ok) throw new Error('The study file is unavailable. Please try again when you’re connected.');
    return response.json();
  }

  function showView(id) {
    views.forEach(view => { $(view).hidden = view !== id; });
  }

  function studyLink(id, section) {
    const params = new URLSearchParams({study: id});
    if (section) params.set('section', section);
    return `#${params}`;
  }

  function renderLibrary() {
    const query = $('study-search').value.trim().toLowerCase();
    const entries = state.catalog.filter(entry => [entry.title, entry.series, entry.passage, entry.date].join(' ').toLowerCase().includes(query));
    $('search-label').hidden = state.catalog.length < 2;
    $('study-list').innerHTML = entries.length ? entries.map(entry => {
      const progress = state.preferences.progress[entry.id];
      const resume = typeof progress?.title === 'string' ? `<p class="resume-place">Your place: ${esc(progress.title)}</p>` : '';
      return `<a class="study-card" href="${esc(studyLink(entry.id))}"><img src="${esc(localURL(entry.cover).href)}" alt="${esc(entry.series)} cover" width="104" height="146"><div><p class="eyebrow">${esc(entry.series)} · ${esc(displayDate(entry.date))}</p><h2>${esc(entry.title)}</h2><p>${esc(entry.passage)}</p>${resume}<span class="open-study">${resume ? 'Continue study' : 'Open study'} →</span></div></a>`;
    }).join('') : '<p>No studies found.</p>';
    document.title = 'Bible Studies';
    showView('library-view');
  }

  function validateStudy(study, entry) {
    if (study.schemaVersion !== 1 || study.id !== entry.id || !Array.isArray(study.steps) || !study.steps.length) throw new Error('This study’s content could not be read.');
    const ids = new Set();
    for (const step of study.steps) {
      if (typeof step.id !== 'string' || ids.has(step.id) || !['cover', 'text', 'discussion'].includes(step.kind)) throw new Error('This study contains an invalid section.');
      ids.add(step.id);
      if (step.kind !== 'discussion') continue;
      if (!Array.isArray(step.refs) || !step.refs.length || typeof step.question !== 'string' || typeof step.guidance !== 'string') throw new Error('A discussion section is incomplete.');
      if (step.refs.some(ref => typeof ref !== 'string' || !ref.trim())) throw new Error('A Scripture reference is missing from this study.');
    }
  }

  function renderReadings(refs) {
    if (state.esv.loading) return '<p class="scripture-message" role="status">Loading ESV passages…</p>';
    if (!state.esv.readings) {
      const links = refs.map(ref => `<a href="https://www.esv.org/${encodeURIComponent(ref)}/" target="_blank" rel="noopener noreferrer">${esc(ref)} on ESV.org ↗</a>`).join('');
      return `<div class="scripture-message"><p>${esc(state.esv.error || 'Connect to load ESV passages.')}</p><button type="button" data-retry-esv>Try again</button><div class="scripture-links">${links}</div></div>`;
    }
    return refs.map(ref => {
      const reading = state.esv.readings[ref.replaceAll('–', '-')];
      return `<section class="reading-block"><h2>${esc(ref)} <span>(ESV)</span></h2><div class="esv-passage">${sanitizeScripture(reading.html)}</div></section>`;
    }).join('');
  }

  function sanitizeScripture(html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const allowed = new Set(['P','DIV','SPAN','SUP','B','STRONG','EM','I','SMALL','BR','H2','H3','H4','BLOCKQUOTE','A']);
    const clean = node => {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
      if (node.nodeType !== Node.ELEMENT_NODE || ['SCRIPT','STYLE','IFRAME','OBJECT','SVG'].includes(node.tagName)) return document.createDocumentFragment();
      const output = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : document.createDocumentFragment();
      if (output.nodeType === Node.ELEMENT_NODE) {
        if (node.className && /^[\w\s-]+$/.test(node.className)) output.className = node.className;
        if (node.tagName === 'A') {
          try {
            const link = new URL(node.getAttribute('href'), 'https://www.esv.org/');
            if (['esv.org','www.esv.org','api.esv.org','crossway.org','www.crossway.org'].includes(link.hostname) && ['http:','https:'].includes(link.protocol)) {
              link.protocol = 'https:';
              output.href = link.href;
              output.target = '_blank';
              output.rel = 'noopener noreferrer';
            }
          } catch { }
        }
      }
      for (const child of node.childNodes) output.append(clean(child));
      return output;
    };
    const container = document.createElement('div');
    for (const child of parsed.body.childNodes) container.append(clean(child));
    return container.innerHTML;
  }

  function refreshScripture() {
    const pane = $('reading-pane');
    if (!pane || !state.study || current().kind !== 'discussion') return;
    pane.querySelector('.scripture-body').innerHTML = renderReadings(current().refs);
  }

  async function loadScripture() {
    if (!state.study || state.esv.loading) return;
    const id = state.study.id;
    const pending = {study:id,readings:null,loading:true,error:''};
    state.esv = pending;
    refreshScripture();
    try {
      if (!esvApiBase) throw new Error('The ESV connection is still being set up.');
      const target = new URL('/study', esvApiBase);
      target.searchParams.set('id', id);
      const response = await fetch(target, {cache:'no-store',signal:AbortSignal.timeout(45000)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ESV passages are temporarily unavailable. Please try again.');
      if (result.study !== id || result.translation !== 'ESV' || !result.readings) throw new Error('ESV passages could not be read. Please try again.');
      for (const step of state.study.steps.filter(step => step.kind === 'discussion')) {
        for (const ref of step.refs) if (typeof result.readings[ref.replaceAll('–', '-')]?.html !== 'string') throw new Error('ESV returned an incomplete study. Please try again.');
      }
      if (state.esv === pending) pending.readings = result.readings;
    } catch (error) {
      if (state.esv === pending) pending.error = navigator.onLine ? error.message : 'Your study is available offline. Reconnect to load ESV passages.';
    } finally {
      if (state.esv === pending) {
        pending.loading = false;
        refreshScripture();
      }
    }
  }

  function applyFocus() {
    $('study-content').querySelectorAll('[data-pane]').forEach(pane => {
      pane.open = pane.dataset.pane === 'host' ? state.hostOpen : state.open.includes(pane.dataset.pane);
      pane.dataset.active = String(pane.dataset.pane === state.focus);
    });
    $('focus-tabs').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.focus === state.focus)));
    $('study-status').textContent = `${names[state.focus] || 'Sections collapsed'} · ${state.together ? 'Together view' : 'Focused view'}`;
    $('study-status').hidden = false;
  }

  function focus(key) {
    state.focus = key;
    state.open = state.together ? ['read', 'discuss'] : [key];
    applyFocus();
  }

  function resetSection(id) {
    state.section = id;
    state.focus = 'read';
    state.open = state.together ? ['read', 'discuss'] : ['read'];
    state.hostOpen = false;
  }

  function renderSection() {
    const step = current();
    const index = state.study.steps.indexOf(step);
    $('study-location').value = step.id;
    $('study-count').textContent = `${index + 1} of ${state.study.steps.length}`;
    $('study-progress').value = (index + 1) / state.study.steps.length * 100;
    $('study-section').textContent = step.section;
    const discussion = step.kind === 'discussion';
    $('focus-tabs').hidden = $('together-label').hidden = !discussion;
    $('keep-together').checked = state.together;
    $('study-status').hidden = true;
    if (discussion) {
      $('study-content').innerHTML = `<details id="reading-pane" data-pane="read"><summary>Scripture</summary><div class="scripture-body">${renderReadings(step.refs)}</div></details><details id="discussion-pane" data-pane="discuss"><summary>Discussion</summary><p>${esc(step.question)}</p></details><details id="host-pane" data-pane="host"><summary>Host Guidance</summary><p>${esc(step.guidance)}</p></details>`;
      applyFocus();
      $('study-content').querySelectorAll('details').forEach(pane => pane.querySelector('summary').addEventListener('click', event => {
        event.preventDefault();
        const key = pane.dataset.pane;
        if (key === 'host') {
          state.hostOpen = !state.hostOpen;
        } else if (pane.open) {
          state.open = state.open.filter(item => item !== key);
          if (state.focus === key) state.focus = state.open[0] || '';
        } else {
          focus(key);
          return;
        }
        applyFocus();
      }));
    } else if (step.kind === 'cover') {
      $('study-content').innerHTML = `<img class="study-cover" src="${esc(localURL(state.study.cover).href)}" alt="${esc(state.study.series)} cover">`;
    } else {
      $('study-content').innerHTML = (step.paragraphs || []).map(text => `<p>${esc(text)}</p>`).join('') + (step.items ? `<ul>${step.items.map(text => `<li>${esc(text)}</li>`).join('')}</ul>` : '');
    }
    $('previous-section').disabled = index === 0;
    $('next-section').disabled = index === state.study.steps.length - 1;
    $('next-section-name').textContent = state.study.steps[index + 1] ? `Up next: ${state.study.steps[index + 1].title}` : 'End of guide';
    $('study-source').innerHTML = `${esc(displayDate(state.study.date))}${discussion ? ' · <a href="https://www.esv.org/" target="_blank" rel="noopener noreferrer">English Standard Version (ESV)</a>' : ''}`;
    state.preferences.progress[state.study.id] = {section: step.id, title: step.title};
    savePreferences();
  }

  function renderStudy() {
    $('study-series').textContent = state.study.series;
    $('study-title').textContent = state.study.title;
    $('study-subtitle').textContent = `${state.study.passage} · ${displayDate(state.study.date)}`;
    $('study-location').innerHTML = state.study.steps.map((step, i) => `<option value="${esc(step.id)}">${i + 1}. ${esc(step.title)}</option>`).join('');
    document.title = `${state.study.title} · Bible Studies`;
    renderSection();
    showView('study-view');
  }

  function goToSection(id) {
    if (!state.study.steps.some(step => step.id === id)) return;
    resetSection(id);
    history.pushState(null, '', studyLink(state.study.id, id));
    renderSection();
    $('study-location').scrollIntoView({block: 'start'});
  }

  function showError(error) {
    $('error-message').textContent = navigator.onLine ? error.message : 'You’re offline. Reconnect to open a study that hasn’t been saved on this device yet.';
    showView('error-view');
  }

  async function loadRoute() {
    const request = ++requestNumber;
    try {
      if (!state.catalog.length) {
        const catalog = await readJSON('studies/index.json');
        if (request !== requestNumber) return;
        if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.studies)) throw new Error('The study library could not be read.');
        state.catalog = catalog.studies;
      }
      const route = new URLSearchParams(location.hash.slice(1));
      const id = route.get('study');
      if (!id) return renderLibrary();
      const entry = state.catalog.find(item => item.id === id);
      if (!entry) throw new Error('This study isn’t in the library. Please choose a study from the library.');
      if (state.study?.id !== id) {
        const study = await readJSON(entry.file);
        if (request !== requestNumber) return;
        validateStudy(study, entry);
        state.study = study;
        state.entry = entry;
        state.together = false;
        state.esv = {study:id,readings:null,loading:false,error:''};
      } else if ($('study-view').hidden) {
        state.together = false;
      }
      const saved = state.preferences.progress[id]?.section;
      const requestedSection = route.get('section') || saved;
      resetSection(state.study.steps.some(step => step.id === requestedSection) ? requestedSection : firstSection(state.study));
      history.replaceState(null, '', studyLink(id, state.section));
      renderStudy();
      if (!state.esv.readings && !state.esv.loading) loadScripture();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => registration.active?.postMessage({type: 'SAVE_STUDY', paths: [entry.file, entry.cover]})).catch(() => {});
      }
    } catch (error) {
      if (request === requestNumber) showError(error);
    }
  }

  $('study-location').addEventListener('change', () => goToSection($('study-location').value));
  $('focus-tabs').querySelectorAll('button').forEach(button => button.addEventListener('click', () => focus(button.dataset.focus)));
  $('keep-together').addEventListener('change', () => {
    state.together = $('keep-together').checked;
    if (!state.focus) state.focus = 'read';
    state.open = state.together ? ['read', 'discuss'] : [state.focus];
    applyFocus();
  });
  $('previous-section').addEventListener('click', () => {
    const previous = state.study.steps[state.study.steps.indexOf(current()) - 1];
    if (previous) goToSection(previous.id);
  });
  $('next-section').addEventListener('click', () => {
    const next = state.study.steps[state.study.steps.indexOf(current()) + 1];
    if (next) goToSection(next.id);
  });
  $('study-content').addEventListener('click', event => {
    if (event.target.closest('[data-retry-esv]')) loadScripture();
  });
  $('study-search').addEventListener('input', renderLibrary);
  $('retry-load').addEventListener('click', loadRoute);
  window.addEventListener('hashchange', loadRoute);
  window.addEventListener('popstate', loadRoute);
  const updateConnection = () => { $('connection-status').hidden = navigator.onLine; };
  window.addEventListener('online', () => {
    updateConnection();
    if (state.study && !state.esv.readings && !state.esv.loading) loadScripture();
  });
  window.addEventListener('offline', updateConnection);
  loadPreferences();
  updateConnection();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register(new URL('sw.js', base), {scope: base.pathname, updateViaCache: 'none'}).catch(() => {});
  }
  loadRoute();
})();
