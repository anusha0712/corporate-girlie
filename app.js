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

// Generate mode output
const generateOutput  = document.getElementById('generate-output');
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

// Reframe output
const reframeOutput   = document.getElementById('reframe-output');

// -- State --
let currentMode   = 'generate';
let savedPhrases  = []; // { phrase, usage }
let recentPhrases = []; // last 3 generated phrases for repetition avoidance

// ======================================
// Mode toggle
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

  topicSection.hidden   = !isGenerate;
  reframeSection.hidden = isGenerate;

  btnText.textContent = isGenerate ? 'Generate ✨' : 'Reframe 💄';

  // Show the output area for the active mode
  if (isGenerate) {
    reframeOutput.hidden  = true;
    generateOutput.hidden = currentPhrase.textContent === '' && savedPhrases.length === 0;
  } else {
    generateOutput.hidden = true;
    reframeOutput.hidden  = reframeOutput.children.length === 0;
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
    if (currentMode === 'generate' && recentPhrases.length > 0) {
      body.recentPhrases = recentPhrases.slice(-3);
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
      showCurrentPhrase(data.phrase, data.usage || '');
    } else {
      addReframeCard(data.phrase);
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
// Generate mode — current phrase display
// ======================================

function showCurrentPhrase(phrase, usage) {
  currentPhrase.textContent = phrase;
  currentUsage.textContent  = usage;
  currentUsage.hidden       = !usage;

  generateOutput.hidden = false;

  // Reset save button
  saveBtn.textContent = 'Save';
  saveBtn.disabled    = false;
  saveBtn.classList.remove('saved');

  // Wire copy button to this specific phrase
  copyCurrent.onclick = () => copyPhrase(phrase, copyCurrent);

  // Wire save button
  saveBtn.onclick = () => savePhraseToList(phrase, usage);
}

function showError(message) {
  if (currentMode === 'generate') {
    showCurrentPhrase(message, '');
  } else {
    addReframeCard(message);
  }
}

// ======================================
// Save phrase
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

// Arsenal modal — open / close
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
  copyAllBtn.textContent = 'Copied! ✨';
  setTimeout(() => { copyAllBtn.textContent = 'Copy all'; }, 1500);
}

// ======================================
// Reframe mode — growing card list
// ======================================

function addReframeCard(phrase) {
  reframeOutput.hidden = false;

  const card = document.createElement('div');
  card.className = 'phrase-card';

  const p = document.createElement('p');
  p.className   = 'phrase-text';
  p.textContent = phrase;

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'copy-btn';
  btn.setAttribute('aria-label', 'Copy phrase');
  btn.textContent = 'Copy';
  btn.addEventListener('click', () => copyPhrase(phrase, btn));

  card.appendChild(p);
  card.appendChild(btn);

  reframeOutput.insertBefore(card, reframeOutput.firstChild);
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
  btn.textContent = 'copied! ✨';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = 'Copy';
    btn.classList.remove('copied');
  }, 1500);
}
