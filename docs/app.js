(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const base = new URL('./', document.baseURI);
  const storageKey = `bible-studies:${base.pathname}:v1`;
  const views = ['library-view', 'study-view', 'error-view'];
  const translations = [{id: 'web', abbreviation: 'WEB', name: 'World English Bible'}];
  const names = {read: 'Reading', discuss: 'Discussion'};
  const state = {catalog: [], study: null, entry: null, section: '', focus: 'read', open: ['read'], hostOpen: false, together: false, preferences: {bibleVersion: 'web', progress: {}}};
  let requestNumber = 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const current = () => state.study.steps.find(step => step.id === state.section);
  const firstReading = study => study.steps.find(step => step.kind === 'discussion')?.id || study.steps[0].id;

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
        state.preferences.bibleVersion = translations.some(item => item.id === saved.bibleVersion) ? saved.bibleVersion : 'web';
        if (saved.progress && typeof saved.progress === 'object' && !Array.isArray(saved.progress)) state.preferences.progress = saved.progress;
      }
    } catch {
      // A damaged preference must never prevent opening a study.
    }
    $('bible-version').value = state.preferences.bibleVersion;
    $('bible-version').title = translations.find(item => item.id === state.preferences.bibleVersion).name;
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
    if (study.schemaVersion !== 1 || study.id !== entry.id || !Array.isArray(study.steps) || !study.steps.length || !study.readings) throw new Error('This study’s content could not be read.');
    const ids = new Set();
    for (const step of study.steps) {
      if (typeof step.id !== 'string' || ids.has(step.id) || !['cover', 'text', 'discussion'].includes(step.kind)) throw new Error('This study contains an invalid section.');
      ids.add(step.id);
      if (step.kind !== 'discussion') continue;
      if (!Array.isArray(step.refs) || !step.refs.length || typeof step.question !== 'string' || typeof step.guidance !== 'string') throw new Error('A discussion section is incomplete.');
      for (const ref of step.refs) {
        const reading = study.readings[ref.replaceAll('–', '-')];
        if (!Array.isArray(reading?.verses) || !reading.verses.length || reading.translation_id !== 'web') throw new Error('A Scripture passage is missing from this study.');
      }
    }
  }

  function renderReadings(refs) {
    return refs.map(ref => {
      const reading = state.study.readings[ref.replaceAll('–', '-')];
      return `<section class="reading-block"><h2>${esc(ref)} <span>(${esc(reading.translation_id.toUpperCase())})</span></h2>${reading.verses.map(verse => `<p><sup>${esc(verse.verse)}</sup> ${esc(verse.text)}</p>`).join('')}</section>`;
    }).join('');
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
      $('study-content').innerHTML = `<details id="reading-pane" data-pane="read"><summary>Scripture</summary>${renderReadings(step.refs)}</details><details id="discussion-pane" data-pane="discuss"><summary>Discussion</summary><p>${esc(step.question)}</p></details><details id="host-pane" data-pane="host"><summary>Host Guidance</summary><p>${esc(step.guidance)}</p></details>`;
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
    $('study-source').textContent = `${displayDate(state.study.date)}${discussion ? ' · World English Bible · Public domain' : ''}`;
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
      } else if ($('study-view').hidden) {
        state.together = false;
      }
      const saved = state.preferences.progress[id]?.section;
      const requestedSection = route.get('section') || saved;
      resetSection(state.study.steps.some(step => step.id === requestedSection) ? requestedSection : firstReading(state.study));
      history.replaceState(null, '', studyLink(id, state.section));
      renderStudy();
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
  $('bible-version').addEventListener('change', () => {
    state.preferences.bibleVersion = $('bible-version').value;
    $('bible-version').title = translations.find(item => item.id === state.preferences.bibleVersion).name;
    savePreferences();
  });
  $('study-search').addEventListener('input', renderLibrary);
  $('retry-load').addEventListener('click', loadRoute);
  window.addEventListener('hashchange', loadRoute);
  window.addEventListener('popstate', loadRoute);
  const updateConnection = () => { $('connection-status').hidden = navigator.onLine; };
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  loadPreferences();
  updateConnection();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register(new URL('sw.js', base), {scope: base.pathname, updateViaCache: 'none'}).catch(() => {});
  }
  loadRoute();
})();
