import { PROMPT_VERSION } from './prompt.js';

// ======================================
// Topic pool — generate mode only
// ======================================
const TOPICS = [
  "we've been debating the same decision for three weeks and nothing is moving",
  "I have to tell my team we're not getting the additional headcount we asked for",
  "leadership keeps changing the priorities mid-sprint and the team is frustrated",
  "we're supposed to launch next week but the product still has too many rough edges",
  "two senior engineers fundamentally disagree on the technical approach and it's blocking the whole team",
  "the client keeps adding requirements without adjusting the timeline or budget",
  "the team has been in crunch mode for two months and morale is tanking",
  "we have to cut features before launch but we can't agree on which ones to cut",
  "we got feedback that our roadmap is too conservative and we need to take bigger swings",
  "we are three sprints behind and the big stakeholder review is tomorrow morning",
];

const DRAFT_KEY = 'eval-session-draft';

// ======================================
// State
// ======================================
let session        = null;
let currentPhrase  = null;   // { phrase, usage, topic }
let prefetched     = null;   // pre-loaded next phrase
let isFetching     = false;
let topicQueue     = [];
let topicIndex     = 0;
let recentPhrases  = [];     // last 3, passed to API to avoid repetition

// ======================================
// Elements
// ======================================
const evalStatsEl    = document.getElementById('eval-stats');
const sendBtn        = document.getElementById('send-btn');
const evalStart      = document.getElementById('eval-start');
const evalLoading    = document.getElementById('eval-loading');
const evalError      = document.getElementById('eval-error');
const evalPhraseCard = document.getElementById('eval-phrase-card');
const evalPhraseText = document.getElementById('eval-phrase-text');
const evalUsageText  = document.getElementById('eval-usage-text');
const evalNoteEl     = document.getElementById('eval-note');
const evalRatingRow  = document.getElementById('eval-rating-row');
const startBtn       = document.getElementById('start-btn');
const resumeBtn      = document.getElementById('resume-btn');
const retryBtn       = document.getElementById('retry-btn');

// ======================================
// Local persistence
// ======================================
function saveSessionLocal() {
  if (session) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(session));
  }
}

function clearSessionLocal() {
  localStorage.removeItem(DRAFT_KEY);
}

function loadSessionLocal() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ======================================
// Helpers
// ======================================
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getNextTopic() {
  if (topicIndex >= topicQueue.length) {
    topicQueue = shuffle(TOPICS);
    topicIndex = 0;
  }
  return topicQueue[topicIndex++];
}

// Show one panel, hide the rest
function showArea(id) {
  for (const el of [evalStart, evalLoading, evalError, evalPhraseCard]) {
    el.hidden = (el.id !== id);
  }
}

function setRatingBtnsDisabled(disabled) {
  document.querySelectorAll('.rate-btn').forEach(b => { b.disabled = disabled; });
}

// ======================================
// API
// ======================================
async function fetchPhrase(topic) {
  const body = { mode: 'generate', input: topic };
  if (recentPhrases.length > 0) body.recentPhrases = recentPhrases.slice(-3);

  const res  = await fetch('/api/generate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return { phrase: data.phrase, usage: data.usage || '', topic };
}

// Start fetching the next phrase silently in the background
function prefetchNext() {
  if (isFetching || prefetched) return;
  isFetching = true;
  fetchPhrase(getNextTopic())
    .then(p => { prefetched = p; isFetching = false; })
    .catch(()  => { isFetching = false; });
}

// ======================================
// Display
// ======================================
function showPhrase(phraseData) {
  currentPhrase = phraseData;
  recentPhrases.push(phraseData.phrase);
  if (recentPhrases.length > 3) recentPhrases.shift();

  evalPhraseText.textContent = phraseData.phrase;

  if (phraseData.usage) {
    evalUsageText.textContent = phraseData.usage;
    evalUsageText.hidden = false;
  } else {
    evalUsageText.hidden = true;
  }

  // Restart entrance animation
  evalPhraseCard.style.animation = 'none';
  evalPhraseCard.offsetHeight;   // trigger reflow
  evalPhraseCard.style.animation = '';

  evalNoteEl.value = '';
  showArea('eval-phrase-card');
  setRatingBtnsDisabled(false);
}

function updateStats() {
  if (!session) return;
  const n    = session.results.length;
  const good = session.results.filter(r => r.rating === 'good').length;
  const eh   = session.results.filter(r => r.rating === 'eh').length;
  const bad  = session.results.filter(r => r.rating === 'bad').length;

  evalStatsEl.textContent = n === 0
    ? '0 rated'
    : `${n} — ${good} good / ${eh} eh / ${bad} bad`;

  if (n >= 5) sendBtn.hidden = false;
}

// ======================================
// Session start / resume
// ======================================
async function startSession() {
  clearSessionLocal();
  session       = { version: PROMPT_VERSION, startedAt: new Date().toISOString(), results: [] };
  topicQueue    = shuffle(TOPICS);
  topicIndex    = 0;
  recentPhrases = [];
  prefetched    = null;

  evalRatingRow.hidden = false;
  setRatingBtnsDisabled(true);
  updateStats();
  showArea('eval-loading');

  try {
    const p = await fetchPhrase(getNextTopic());
    showPhrase(p);
    prefetchNext();
  } catch {
    showArea('eval-error');
  }
}

async function resumeSession() {
  const saved = loadSessionLocal();
  if (!saved) { startSession(); return; }

  session       = saved;
  topicQueue    = shuffle(TOPICS);
  topicIndex    = 0;
  recentPhrases = session.results.slice(-3).map(r => r.phrase);
  prefetched    = null;

  evalRatingRow.hidden = false;
  setRatingBtnsDisabled(true);
  updateStats();
  showArea('eval-loading');

  try {
    const p = await fetchPhrase(getNextTopic());
    showPhrase(p);
    prefetchNext();
  } catch {
    showArea('eval-error');
  }
}

// Retry after an error — keeps current session data
async function retryFetch() {
  setRatingBtnsDisabled(true);
  showArea('eval-loading');
  try {
    const p = await fetchPhrase(getNextTopic());
    showPhrase(p);
    prefetchNext();
  } catch {
    showArea('eval-error');
  }
}

// ======================================
// Rating + advance
// ======================================
async function rate(rating) {
  if (!currentPhrase || !session) return;

  const note = evalNoteEl.value.trim();
  session.results.push({
    phrase:  currentPhrase.phrase,
    usage:   currentPhrase.usage,
    topic:   currentPhrase.topic,
    rating,
    ...(note ? { note } : {}),
  });

  saveSessionLocal();

  // Flash the tapped button for 400ms
  setRatingBtnsDisabled(true);
  const btn = document.querySelector(`.rate-btn[data-rating="${rating}"]`);
  btn.classList.add(`flash-${rating}`);

  updateStats();

  await new Promise(r => setTimeout(r, 400));
  btn.classList.remove(`flash-${rating}`);

  // Show next phrase (instant if pre-fetched, otherwise load)
  if (prefetched) {
    const next = prefetched;
    prefetched = null;
    showPhrase(next);
    prefetchNext();
  } else {
    showArea('eval-loading');
    setRatingBtnsDisabled(true);
    try {
      const p = await fetchPhrase(getNextTopic());
      showPhrase(p);
      prefetchNext();
    } catch {
      showArea('eval-error');
    }
  }
}

// ======================================
// Save session — downloads JSON to device (always works) +
// silently attempts GitHub commit as a bonus
// ======================================
function saveSession() {
  if (!session || session.results.length === 0) return;

  // Download to device — this never fails
  const json    = JSON.stringify(session, null, 2);
  const blob    = new Blob([json], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href        = url;
  a.download    = `evals-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Silently try GitHub too — ignore if it fails
  fetch('/api/save-eval', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ session }),
  }).catch(() => {});

  clearSessionLocal();
  sendBtn.textContent = 'Saved ✦';
  setTimeout(() => {
    sendBtn.disabled    = false;
    sendBtn.textContent = 'Save session';
  }, 2500);
}

// ======================================
// On load — check for saved draft
// ======================================
const savedDraft = loadSessionLocal();
if (savedDraft && savedDraft.results && savedDraft.results.length > 0) {
  resumeBtn.textContent = `Resume (${savedDraft.results.length} rated)`;
  resumeBtn.hidden = false;
}

// ======================================
// Event listeners
// ======================================
startBtn.addEventListener('click', startSession);
resumeBtn.addEventListener('click', resumeSession);
retryBtn.addEventListener('click', retryFetch);
sendBtn.addEventListener('click',  saveSession);

document.querySelectorAll('.rate-btn').forEach(btn => {
  btn.addEventListener('click', () => rate(btn.dataset.rating));
});
