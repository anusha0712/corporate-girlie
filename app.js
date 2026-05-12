// ======================================
// Corporate Girlie — frontend logic
// ======================================

// -- Elements --
const btnGenerate     = document.getElementById('btn-generate');
const btnReframe      = document.getElementById('btn-reframe');
const topicSection    = document.getElementById('topic-section');
const reframeSection  = document.getElementById('reframe-section');
const reframeInput    = document.getElementById('reframe-input');
const charCount       = document.getElementById('char-count');
const submitBtn       = document.getElementById('submit-btn');
const btnText         = document.getElementById('btn-text');
const btnLoading      = document.getElementById('btn-loading');

// Single output stack (used by both modes)
const currentCard     = document.getElementById('current-card');
const currentPhrase   = document.getElementById('current-phrase');
const currentUsage    = document.getElementById('current-usage');
const copyCurrent     = document.getElementById('copy-current-btn');
const saveBtn         = document.getElementById('save-btn');

// Saved panel
const savedSection    = document.getElementById('saved-section');
const savedToggleBtn  = document.getElementById('saved-toggle-btn');
const savedCountEl    = document.getElementById('saved-count');
const savedList       = document.getElementById('saved-list');
const copyAllBtn      = document.getElementById('copy-all-btn');

// Arsenal modal
const arsenalModal    = document.getElementById('arsenal-modal');
const arsenalBackdrop = document.getElementById('arsenal-backdrop');
const arsenalCloseBtn = document.getElementById('arsenal-close-btn');

// -- State --
let currentMode       = 'generate';
let savedPhrases      = []; // { phrase, usage }
let recentPhrases     = []; // last 3 phrases — prevents exact repetition
let recentCategories  = []; // last 10 categories — enforces beauty domain rotation
// Per-mode card memory: each mode keeps its own last result so switching
// modes restores that mode's card instead of clearing it.
let lastResults       = { generate: null, reframe: null };

// ======================================
// Mode toggle
// Swaps body[data-mode] so CSS picks up the right filled-state values,
// toggles which input section is visible, and updates submit text.
// ======================================

btnGenerate.addEventListener('click', () => setMode('generate'));
btnReframe.addEventListener('click',  () => setMode('reframe'));

function setMode(mode) {
  currentMode = mode;
  const isGenerate = mode === 'generate';

  btnGenerate.classList.toggle('active', isGenerate);
  btnGenerate.setAttribute('aria-pressed', String(isGenerate));
  btnReframe.classList.toggle('active', !isGenerate);
  btnReframe.setAttribute('aria-pressed', String(!isGenerate));

  // Toggle every section keyed to this mode (input wraps)
  document.querySelectorAll('[data-mode-section]').forEach(el => {
    el.hidden = el.dataset.modeSection !== mode;
  });

  // Body data-mode drives CSS variable cascade for filled-mode layouts
  document.body.dataset.mode = mode;

  btnText.innerHTML = isGenerate
    ? 'Generate <span aria-hidden="true">✦</span>'
    : 'Reframe <span aria-hidden="true">✦</span>';

  // Restore this mode's last result, or fall back to the empty screen.
  const last = lastResults[mode];
  if (last) {
    showCurrentPhrase(last.phrase, last.usage);
  } else {
    document.body.dataset.state = 'empty';
  }
}

// ======================================
// Character counter (reframe textarea)
// ======================================

reframeInput.addEventListener('input', () => {
  charCount.textContent = reframeInput.value.length;
});

// ======================================
// Submit
// ======================================

submitBtn.addEventListener('click', handleSubmit);

async function handleSubmit() {
  const input = currentMode === 'reframe'
    ? reframeInput.value.trim()
    : document.getElementById('topic-input').value.trim();

  setLoading(true);

  try {
    const body = { mode: currentMode, input };
    if (currentMode === 'generate') {
      if (recentPhrases.length > 0)    body.recentPhrases    = recentPhrases.slice(-3);
      if (recentCategories.length > 0) body.recentCategories = recentCategories.slice(-10);
    }

    const res  = await fetch('/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "the mirror's a little foggy — try again in a sec");
    } else if (currentMode === 'generate') {
      recentPhrases.push(data.phrase);
      if (recentPhrases.length > 3) recentPhrases.shift();
      if (data.category) {
        recentCategories.push(data.category);
        if (recentCategories.length > 10) recentCategories.shift();
      }
      showCurrentPhrase(data.phrase, data.usage || '');
    } else {
      // Reframe also uses the single-card pattern
      showCurrentPhrase(data.phrase, '');
    }
  } catch {
    showError("the mirror's a little foggy — try again in a sec");
  }

  setLoading(false);
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.hidden     = loading;
  btnLoading.hidden  = !loading;
}

// ======================================
// Single current-phrase card (shared by both modes)
// ======================================

function showCurrentPhrase(phrase, usage) {
  // Remember per-mode so switching modes restores this card.
  lastResults[currentMode] = { phrase, usage };

  currentPhrase.textContent = phrase;
  currentUsage.textContent  = usage;
  currentUsage.hidden       = !usage;

  // Body state flip — CSS swaps in filled-state values
  document.body.dataset.state = 'filled';

  // If this phrase has already been saved, reflect that on the Save button.
  const alreadySaved = savedPhrases.some(p => p.phrase === phrase);
  if (alreadySaved) {
    saveBtn.textContent = 'Saved ✦';
    saveBtn.disabled    = true;
    saveBtn.classList.add('saved');
  } else {
    saveBtn.textContent = 'Save';
    saveBtn.disabled    = false;
    saveBtn.classList.remove('saved');
  }

  copyCurrent.onclick = () => copyPhrase(phrase, copyCurrent);
  saveBtn.onclick     = () => savePhraseToList(phrase, usage);
}

function showError(message) {
  showCurrentPhrase(message, '');
}

// ======================================
// Save phrase + arsenal
// ======================================

function savePhraseToList(phrase, usage) {
  savedPhrases.push({ phrase, usage });

  saveBtn.textContent = 'Saved ✦';
  saveBtn.disabled    = true;
  saveBtn.classList.add('saved');

  savedSection.hidden = false;
  savedCountEl.textContent = savedPhrases.length;
}

function renderSavedList() {
  savedList.innerHTML = '';

  savedPhrases.forEach(({ phrase, usage }, index) => {
    const item = document.createElement('div');
    item.className = 'saved-item';

    const content = document.createElement('div');
    content.className = 'saved-item-content';

    const phraseEl = document.createElement('p');
    phraseEl.className   = 'saved-phrase-text';
    phraseEl.textContent = phrase;
    content.appendChild(phraseEl);

    if (usage) {
      const usageEl = document.createElement('p');
      usageEl.className   = 'saved-usage-text';
      usageEl.textContent = usage;
      content.appendChild(usageEl);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type      = 'button';
    deleteBtn.className = 'delete-saved-btn';
    deleteBtn.setAttribute('aria-label', 'Remove from arsenal');
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => {
      savedPhrases.splice(index, 1);
      savedCountEl.textContent = savedPhrases.length;
      if (savedPhrases.length === 0) {
        savedSection.hidden = true;
        closeArsenal();
      } else {
        renderSavedList();
      }
    });

    item.appendChild(content);
    item.appendChild(deleteBtn);
    savedList.appendChild(item);
  });

  savedCountEl.textContent = savedPhrases.length;
}

function openArsenal() {
  renderSavedList();
  arsenalModal.hidden = false;
}

function closeArsenal() {
  arsenalModal.hidden = true;
}

savedToggleBtn.addEventListener('click', openArsenal);
arsenalCloseBtn.addEventListener('click', closeArsenal);
arsenalBackdrop.addEventListener('click', closeArsenal);

// Copy all — phrases only, one per line
copyAllBtn.addEventListener('click', () => {
  const text = savedPhrases.map(({ phrase }) => phrase).join('\n\n');
  navigator.clipboard.writeText(text)
    .then(() => showCopiedAll())
    .catch(() => showCopiedAll());
});

function showCopiedAll() {
  copyAllBtn.textContent = 'Copied! ✦';
  setTimeout(() => { copyAllBtn.textContent = 'Copy all'; }, 1500);
}

// ======================================
// Copy to clipboard
// ======================================

function copyPhrase(phrase, btn) {
  navigator.clipboard.writeText(phrase)
    .then(() => showCopied(btn))
    .catch(() => showCopied(btn));
}

function showCopied(btn) {
  const original = btn.textContent;
  btn.textContent = 'Copied ✦';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('copied');
  }, 1500);
}
