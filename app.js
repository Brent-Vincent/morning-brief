/* Morning Brief: a private, explainable, browser-based personalized news edition. */
(() => {
  'use strict';

  const STORAGE_KEY = 'morning-brief-profile-v1';
  const TZ = 'Asia/Jakarta';
  const PRIORITY_SCORE = { low: -2, normal: 1.2, high: 5 };
  const DEMO_ARTICLES = [
    ['demo-1', 'Example headline: The day’s biggest international developments', 'https://www.bbc.com/news/world', 'BBC News (sample)', 'World'],
    ['demo-2', 'Example headline: The technology stories people are talking about', 'https://www.bbc.com/news/technology', 'BBC News (sample)', 'Technology'],
    ['demo-3', 'Example headline: What’s happening in Indonesia today', 'https://news.google.com/?hl=en-US&gl=ID&ceid=ID:en', 'Google News (sample)', 'Indonesia'],
    ['demo-4', 'Example headline: A new chapter for artificial intelligence', 'https://news.google.com/search?q=artificial%20intelligence', 'Google News (sample)', 'AI'],
    ['demo-5', 'Example headline: Markets and business in focus', 'https://www.bbc.com/news/business', 'BBC News (sample)', 'Business'],
    ['demo-6', 'Example headline: What scientists discovered this week', 'https://www.bbc.com/news/science_and_environment', 'BBC News (sample)', 'Science'],
    ['demo-7', 'Example headline: The latest in health research', 'https://www.bbc.com/news/health', 'BBC News (sample)', 'Health'],
    ['demo-8', 'Example headline: Behind the scenes in the film industry', 'https://www.bbc.com/news/entertainment_and_arts', 'BBC News (sample)', 'Entertainment']
  ].map(([id, title, url, source, topic], index) => ({
    id, title, url, source, topic,
    published: new Date(Date.now() - index * 65 * 60000).toISOString()
  }));
  const STOPWORDS = new Set('about above after again against almost along already also although among another any are because been before being between both could daily does doing during each even every from have here into just like more most much news over only other our out own said says since some such than that their them there these they this those through under until upon very what when where which while will with would your today latest report reports example headline breaking update'.split(' '));
  const $ = (id) => document.getElementById(id);
  const els = {
    articleList: $('articleList'), emptyState: $('emptyState'), savedCount: $('savedCount'),
    topicNav: $('topicNav'), topicSettings: $('topicSettings'), sourceSettings: $('sourceSettings'),
    prioritySettings: $('prioritySettings'), drawer: $('settingsDrawer'), backdrop: $('settingsBackdrop')
  };
  const initialPreferences = () => ({
    enabledTopics: null,
    priorities: {}, mutedSources: [], boost: [], block: [],
    feedback: {}, opened: {}, saved: {}, hideRead: false, pageSize: 20
  });
  const arr = (x) => Array.isArray(x) ? x : [];
  const obj = (x) => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (str) => String(str ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const niceTime = (date) => {
    const ms = new Date(date).getTime();
    if (!Number.isFinite(ms)) return 'recently';
    const h = Math.max(0, Math.floor((Date.now() - ms) / 3600000));
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  };
  const safeUrl = (value) => {
    try {
      const u = new URL(value);
      return ['http:', 'https:'].includes(u.protocol) ? u.href : '#';
    } catch { return '#'; }
  };
  const parseWords = (value) => String(value || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean).slice(0, 30);
  const tokenize = (value) => [...new Set((String(value || '').toLowerCase().match(/[a-z\u00c0-\u024f]{4,}/g) || []).filter(word => !STOPWORDS.has(word)))].slice(0, 16);
  function normalizePreferences(raw) {
    const p = obj(raw);
    return {
      enabledTopics: Array.isArray(p.enabledTopics) ? p.enabledTopics.filter(x => typeof x === 'string').slice(0, 100) : null,
      priorities: obj(p.priorities),
      mutedSources: arr(p.mutedSources).filter(x => typeof x === 'string').slice(0, 150),
      boost: arr(p.boost).filter(x => typeof x === 'string').slice(0, 30),
      block: arr(p.block).filter(x => typeof x === 'string').slice(0, 30),
      feedback: obj(p.feedback), opened: obj(p.opened), saved: obj(p.saved),
      hideRead: Boolean(p.hideRead), pageSize: [10, 20, 40].includes(Number(p.pageSize)) ? Number(p.pageSize) : 20
    };
  }
  function loadPrefs() {
    try { return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
    catch { return initialPreferences(); }
  }
  let prefs = loadPrefs();
  let draft = null;
  let articles = [];
  let isDemo = true;
  let generatedAt = null;
  let selectedView = 'for-you';
  let query = '';
  let timeHours = 0;
  let visibleCount = prefs.pageSize;

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); }
    catch (error) { console.warn('Could not save browser preferences:', error); }
  }
  function topics() { return [...new Set(articles.map(a => a.topic).filter(Boolean))].sort((a,b) => a.localeCompare(b)); }
  function publishers() {
    const counts = new Map();
    for (const a of articles) counts.set(a.source, (counts.get(a.source) || 0) + 1);
    return [...counts.keys()].sort((a,b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b));
  }
  function topicEnabled(topic, p = prefs) { return !Array.isArray(p.enabledTopics) || p.enabledTopics.includes(topic); }
  function eventModel() {
    const topicBias = {}, sourceBias = {}, wordBias = {};
    const add = (target, key, val) => { if (key) target[key] = (target[key] || 0) + val; };
    for (const event of Object.values(obj(prefs.feedback))) {
      if (!event || !Number.isFinite(Number(event.rating))) continue;
      const rating = clamp(Number(event.rating), -1, 1);
      add(topicBias, event.topic, rating * 2.1);
      add(sourceBias, event.source, rating * 1.1);
      for (const word of tokenize(event.title)) add(wordBias, word, rating * 0.32);
    }
    for (const [id, event] of Object.entries(obj(prefs.opened))) {
      if (!event || prefs.feedback[id]) continue;
      add(topicBias, event.topic, 0.42);
      add(sourceBias, event.source, 0.17);
      for (const word of tokenize(event.title)) add(wordBias, word, 0.07);
    }
    return { topicBias, sourceBias, wordBias };
  }
  function ranking(article, model) {
    const priority = prefs.priorities[article.topic] || 'normal';
    const hours = Math.max(0, (Date.now() - Date.parse(article.published || 0)) / 3600000);
    let score = (PRIORITY_SCORE[priority] ?? PRIORITY_SCORE.normal) + clamp(3.0 - hours * 0.06, -3, 3);
    score += clamp(model.topicBias[article.topic] || 0, -9, 11);
    score += clamp(model.sourceBias[article.source] || 0, -6, 6);
    score += clamp(tokenize(article.title).reduce((acc, w) => acc + (model.wordBias[w] || 0), 0), -5, 6);
    const haystack = `${article.title} ${article.topic} ${article.source}`.toLowerCase();
    for (const word of prefs.boost) if (haystack.includes(word.toLowerCase())) score += 4;
    return score;
  }
  function reason(article, model) {
    const haystack = article.title.toLowerCase();
    if (prefs.boost.some(w => w && haystack.includes(w.toLowerCase()))) return 'MATCHES YOUR KEYWORDS';
    if ((model.topicBias[article.topic] || 0) >= 1.5) return 'BASED ON YOUR FEEDBACK';
    if (prefs.priorities[article.topic] === 'high') return 'YOUR PRIORITY TOPIC';
    return '';
  }
  function filteredArticles() {
    const model = eventModel();
    let pool = selectedView === 'saved' ? Object.values(obj(prefs.saved)) : [...articles];
    if (selectedView.startsWith('topic:')) pool = pool.filter(a => a.topic === selectedView.slice(6));
    if (selectedView !== 'saved') {
      pool = pool.filter(a => topicEnabled(a.topic) && !prefs.mutedSources.includes(a.source));
      if (prefs.hideRead) pool = pool.filter(a => !prefs.opened[a.id]);
    }
    if (prefs.block.length) pool = pool.filter(a => !prefs.block.some(word => `${a.title} ${a.topic} ${a.source}`.toLowerCase().includes(word.toLowerCase())));
    if (query.trim()) pool = pool.filter(a => `${a.title} ${a.topic} ${a.source}`.toLowerCase().includes(query.trim().toLowerCase()));
    if (timeHours) pool = pool.filter(a => (Date.now() - new Date(a.published).getTime()) / 3600000 <= timeHours);
    if (selectedView === 'for-you') pool.sort((a,b) => ranking(b, model) - ranking(a, model) || Date.parse(b.published) - Date.parse(a.published));
    else pool.sort((a,b) => Date.parse(b.published) - Date.parse(a.published));
    return { pool, model };
  }
  function viewName() {
    if (selectedView === 'for-you') return 'Picked for you';
    if (selectedView === 'latest') return 'The latest';
    if (selectedView === 'saved') return 'Saved for later';
    return selectedView.slice(6);
  }
  function viewBreadcrumb() { return selectedView.startsWith('topic:') ? selectedView.slice(6).toUpperCase() : selectedView.replace('-', ' ').toUpperCase(); }
  function renderNavigation() {
    document.querySelectorAll('#mainNav [data-view]').forEach(btn => {
      const isSelected = selectedView === btn.dataset.view;
      btn.classList.toggle('selected', isSelected);
      btn.setAttribute('aria-current', isSelected ? 'page' : 'false');
    });
    els.topicNav.innerHTML = topics().filter(topic => topicEnabled(topic)).map(topic => {
      const active = selectedView === `topic:${topic}`;
      return `<button type="button" class="nav-item ${active ? 'selected' : ''}" data-topic="${esc(topic)}" aria-current="${active ? 'page' : 'false'}"><span class="nav-symbol">◦</span><span>${esc(topic)}</span></button>`;
    }).join('');
    $('viewBreadcrumb').textContent = viewBreadcrumb();
    $('sectionTitle').innerHTML = esc(viewName()) + '<span class="title-dot">.</span>';
    $('savedCount').textContent = Object.keys(obj(prefs.saved)).length;
  }
  function renderStats() {
    $('totalStories').textContent = articles.length;
    $('sourceCount').textContent = new Set(articles.map(a => a.source)).size;
    $('ratingCount').textContent = Object.keys(obj(prefs.feedback)).length;
    $('learningSummary').textContent = `${Object.keys(obj(prefs.feedback)).length} rated · ${Object.keys(obj(prefs.opened)).length} articles opened · ${Object.keys(obj(prefs.saved)).length} saved. Your learning profile stays on this device.`;
    $('demoNotice').hidden = !isDemo;
    const updated = generatedAt ? `UPDATED ${new Intl.DateTimeFormat('en-US', {month: 'short', day:'numeric', hour:'numeric',minute:'2-digit',timeZone: TZ,timeZoneName:'short'}).format(new Date(generatedAt)).toUpperCase()}` : 'SAMPLE EDITION';
    $('lastUpdated').textContent = updated;
    $('topbarEdition').textContent = isDemo ? 'PREVIEW EDITION' : 'LIVE NEWS EDITION';
  }
  function renderTaste() {
    const model = eventModel();
    const ranked = topics().filter(t => topicEnabled(t)).map(t => ({
      topic: t, weight: (prefs.priorities[t] === 'high' ? 3 : prefs.priorities[t] === 'low' ? -2 : 0) + (model.topicBias[t] || 0)
    })).sort((a,b) => b.weight - a.weight);
    const rated = Object.keys(obj(prefs.feedback)).length;
    const strong = ranked.filter(item => item.weight > .05).slice(0, 4);
    if (!rated && !strong.length) {
      $('tasteBars').innerHTML = '<div class="taste-empty">No signals yet. Rate a few headlines and your interests will appear here.</div>';
      return;
    }
    $('tasteBars').innerHTML = (strong.length ? strong : ranked.slice(0, 3)).map(x => {
      const percentage = clamp(Math.round(35 + Math.max(0, x.weight) * 10), 9, 99);
      const status = x.weight >= 5 ? 'STRONG' : x.weight > 0 ? 'GROWING' : 'STARTER';
      return `<div class="taste-row"><div class="taste-label"><span>${esc(x.topic)}</span><span>${status}</span></div><div class="taste-bar-track"><div class="taste-bar-fill" style="width:${percentage}%"></div></div></div>`;
    }).join('');
  }
  function cardMarkup(a, i, model) {
    const rating = Number(prefs.feedback[a.id]?.rating || 0);
    const saved = Boolean(prefs.saved[a.id]);
    const why = selectedView === 'for-you' ? reason(a, model) : '';
    return `<article class="article" data-id="${esc(a.id)}">
      <div class="article-number">${String(i + 1).padStart(2, '0')}</div>
      <div class="article-content">
        <span class="article-category">${esc(a.topic)}</span>
        <h3 class="article-title"><a class="story-link" href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer" data-open="${esc(a.id)}">${esc(a.title)}</a></h3>
        <div class="article-meta"><span class="article-source">${esc(a.source)}</span><span class="article-separator">·</span><span>${esc(niceTime(a.published))}</span>${why ? `<span class="article-separator">·</span><span class="article-reason">✳ ${esc(why)}</span>` : ''}</div>
        <div class="article-actions">
          <button type="button" class="rating-button ${rating === 1 ? 'active' : ''}" aria-pressed="${rating === 1}" data-rating="1" data-id="${esc(a.id)}" title="Prioritize stories like this"><span class="action-symbol">♡</span><span>More like this</span></button>
          <button type="button" class="rating-button down ${rating === -1 ? 'active' : ''}" aria-pressed="${rating === -1}" data-rating="-1" data-id="${esc(a.id)}" title="Show fewer stories like this"><span class="action-symbol">⊘</span><span>Less like this</span></button>
          <button type="button" class="save-action ${saved ? 'active' : ''}" aria-pressed="${saved}" data-save="${esc(a.id)}" title="${saved ? 'Remove from reading list' : 'Save to reading list'}"><span class="action-symbol">${saved ? '◆' : '◇'}</span><span>${saved ? 'Saved' : 'Save'}</span></button>
          <a class="read-action story-link" href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer" data-open="${esc(a.id)}">Read ↗</a>
        </div>
      </div>
    </article>`;
  }
  function renderArticles() {
    renderNavigation(); renderStats(); renderTaste();
    const { pool, model } = filteredArticles();
    $('resultCount').textContent = `${pool.length} ${pool.length === 1 ? 'STORY' : 'STORIES'}`;
    const showing = pool.slice(0, visibleCount);
    els.articleList.innerHTML = showing.map((a, i) => cardMarkup(a, i, model)).join('');
    els.emptyState.hidden = pool.length !== 0;
    $('loadMore').hidden = showing.length >= pool.length;
  }
  function setView(view) {
    selectedView = view;
    visibleCount = prefs.pageSize;
    renderArticles();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function findArticle(id) { return articles.find(a => a.id === id) || prefs.saved[id] || null; }
  function rateArticle(id, rating) {
    const a = findArticle(id); if (!a) return;
    if (Number(prefs.feedback[id]?.rating) === rating) delete prefs.feedback[id];
    else prefs.feedback[id] = { rating, title: a.title, topic: a.topic, source: a.source };
    persist(); renderArticles();
  }
  function saveArticle(id) {
    const a = findArticle(id); if (!a) return;
    if (prefs.saved[id]) delete prefs.saved[id];
    else prefs.saved[id] = a;
    persist(); renderArticles();
  }
  function recordOpen(id) {
    const a = findArticle(id); if (!a) return;
    if (!prefs.opened[id]) {
      prefs.opened[id] = { title: a.title, topic: a.topic, source: a.source };
      persist();
    }
  }
  function openDrawer() {
    draft = JSON.parse(JSON.stringify(prefs));
    els.backdrop.hidden = false;
    els.drawer.classList.add('open');
    els.drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderSettings();
    $('closeSettings').focus();
  }
  function closeDrawer() {
    els.drawer.classList.remove('open');
    els.drawer.setAttribute('aria-hidden', 'true');
    els.backdrop.hidden = true;
    document.body.style.overflow = '';
    draft = null;
  }
  function renderSettings() {
    const availableTopics = topics();
    els.topicSettings.innerHTML = availableTopics.map(topic => `<label class="check-option"><input type="checkbox" data-enable-topic="${esc(topic)}" ${topicEnabled(topic, draft) ? 'checked' : ''}><span>${esc(topic)}</span></label>`).join('');
    els.prioritySettings.innerHTML = availableTopics.filter(topic => topicEnabled(topic, draft)).map(topic => {
      const current = draft.priorities[topic] || 'normal';
      const opts = [['low','Low'],['normal','Normal'],['high','High']];
      return `<label class="priority-item"><span>${esc(topic)}</span><select data-priority-topic="${esc(topic)}">${opts.map(([val,label]) => `<option value="${val}" ${current === val ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`;
    }).join('') || '<p>Enable a topic above to choose its priority.</p>';
    els.sourceSettings.innerHTML = publishers().map(source => `<label class="check-option"><input type="checkbox" data-source="${esc(source)}" ${!draft.mutedSources.includes(source) ? 'checked' : ''}><span>${esc(source)}</span></label>`).join('');
    $('boostKeywords').value = draft.boost.join(', ');
    $('blockKeywords').value = draft.block.join(', ');
    $('hideRead').checked = draft.hideRead;
    $('pageSize').value = String(draft.pageSize);
  }
  function syncDraftInputs() {
    if (!draft) return;
    draft.boost = parseWords($('boostKeywords').value);
    draft.block = parseWords($('blockKeywords').value);
    draft.hideRead = $('hideRead').checked;
    draft.pageSize = Number($('pageSize').value);
  }
  function saveSettings() {
    syncDraftInputs();
    prefs = normalizePreferences(draft);
    visibleCount = prefs.pageSize;
    if (selectedView.startsWith('topic:') && !topicEnabled(selectedView.slice(6))) selectedView = 'for-you';
    persist(); closeDrawer(); renderArticles();
  }
  async function importPreferences(file) {
    if (!file || file.size > 300_000) { alert('Please choose a smaller JSON preferences file.'); return; }
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object') throw Error('Invalid JSON preferences');
      prefs = normalizePreferences(parsed);
      persist(); closeDrawer(); renderArticles();
      alert('Preferences imported into this browser.');
    } catch { alert('Could not import preferences. Make sure this is a Morning Brief JSON export.'); }
  }
  function exportPreferences() {
    const blob = new Blob([JSON.stringify(prefs, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'morning-brief-preferences.json';
    link.click();
    URL.revokeObjectURL(url);
  }
  function showHowItWorks() {
    alert('Morning Brief uses RSS headlines and publisher links. Every morning, GitHub Actions runs a Python fetcher and publishes the new edition. In this browser, “More like this,” “Less like this,” opened links, topic priorities and keywords influence the sorting. “Latest” keeps strict recency order. Your profile is stored in localStorage and is not sent to a server. To add new RSS sources or new search feeds, edit feeds.json with Codex.');
  }
  function wireEvents() {
    document.querySelector('#mainNav').addEventListener('click', e => { const btn = e.target.closest('[data-view]'); if (btn) setView(btn.dataset.view); });
    els.topicNav.addEventListener('click', e => { const btn = e.target.closest('[data-topic]'); if (btn) setView(`topic:${btn.dataset.topic}`); });
    els.articleList.addEventListener('click', e => {
      const button = e.target.closest('button[data-rating],button[data-save]');
      if (button?.dataset.rating) rateArticle(button.dataset.id, Number(button.dataset.rating));
      else if (button?.dataset.save) saveArticle(button.dataset.save);
      const link = e.target.closest('a[data-open]');
      if (link) recordOpen(link.dataset.open);
    });
    $('searchInput').addEventListener('input', e => { query = e.target.value; visibleCount = prefs.pageSize; renderArticles(); });
    $('timeFilter').addEventListener('change', e => { timeHours = Number(e.target.value); visibleCount = prefs.pageSize; renderArticles(); });
    $('loadMore').addEventListener('click', () => { visibleCount += prefs.pageSize; renderArticles(); });
    $('refreshButton').addEventListener('click', () => window.location.reload());
    $('openSettingsSide').addEventListener('click', openDrawer);
    $('openSettingsRail').addEventListener('click', openDrawer);
    $('settingsTop').addEventListener('click', openDrawer);
    $('emptySettings').addEventListener('click', openDrawer);
    $('closeSettings').addEventListener('click', closeDrawer);
    els.backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && draft) closeDrawer(); });
    els.topicSettings.addEventListener('change', e => {
      const box = e.target.closest('input[data-enable-topic]'); if (!box) return;
      syncDraftInputs(); // Keep unfinished keyword/filter edits when topic controls redraw.
      const all = topics();
      if (!draft.enabledTopics) draft.enabledTopics = [...all];
      if (box.checked) draft.enabledTopics = [...new Set([...draft.enabledTopics, box.dataset.enableTopic])];
      else draft.enabledTopics = draft.enabledTopics.filter(t => t !== box.dataset.enableTopic);
      renderSettings();
    });
    els.sourceSettings.addEventListener('change', e => {
      const box = e.target.closest('input[data-source]'); if (!box) return;
      if (box.checked) draft.mutedSources = draft.mutedSources.filter(s => s !== box.dataset.source);
      else draft.mutedSources = [...new Set([...draft.mutedSources, box.dataset.source])];
    });
    els.prioritySettings.addEventListener('change', e => { const select = e.target.closest('[data-priority-topic]'); if (select) draft.priorities[select.dataset.priorityTopic] = select.value; });
    $('saveSettings').addEventListener('click', saveSettings);
    $('resetPrefs').addEventListener('click', () => {
      if (!confirm('Clear all learned ratings, clicks, saved stories and preferences on this browser?')) return;
      prefs = initialPreferences(); persist(); closeDrawer(); selectedView = 'for-you'; visibleCount = prefs.pageSize; renderArticles();
    });
    $('exportPrefs').addEventListener('click', exportPreferences);
    $('importPrefs').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', async e => { await importPreferences(e.target.files?.[0]); e.target.value = ''; });
    $('footerHow').addEventListener('click', showHowItWorks);
  }
  async function loadNews() {
    let data = null;
    try {
      const response = await fetch(`./data/headlines.json?ts=${Date.now()}`, {cache: 'no-store'});
      if (!response.ok) throw Error(`News file not available (HTTP ${response.status})`);
      data = await response.json();
      if (!Array.isArray(data.articles)) throw Error('The headlines JSON file is missing its articles array');
    } catch (error) {
      $('errorNotice').hidden = false;
      $('errorMessage').textContent = 'The live JSON file could not be loaded here. This standalone preview is using example stories. Run a local web server or publish through GitHub Pages to use live headlines.';
      console.warn('Falling back to preview headlines:', error);
    }
    isDemo = !data || Boolean(data.demo);
    generatedAt = data?.generated_at || null;
    const raw = data?.articles?.length ? data.articles : DEMO_ARTICLES;
    articles = raw.filter(a => a && a.id && a.title && safeUrl(a.url) !== '#').map((a, index) => ({
      id: String(a.id), title: String(a.title), url: a.url,
      source: String(a.source || 'Unknown publisher'), topic: String(a.topic || 'Other'),
      published: isDemo ? new Date(Date.now() - index * 65 * 60000).toISOString() : a.published
    }));
    if (raw === DEMO_ARTICLES) isDemo = true;
    const demoName = isDemo ? 'PREVIEW EDITION' : 'LIVE NEWS EDITION';
    $('topbarEdition').textContent = demoName;
    renderArticles();
  }
  function setGreeting() {
    const current = new Date();
    const hr = Number(new Intl.DateTimeFormat('en-GB', {hour:'2-digit',hourCycle:'h23',timeZone:TZ}).format(current));
    const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    $('greeting').innerHTML = esc(greeting) + '<span class="title-dot">.</span>';
    $('todayDate').textContent = new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:TZ}).format(current);
    $('footerYear').textContent = current.getFullYear();
  }
  setGreeting(); wireEvents(); loadNews();
})();
