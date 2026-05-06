// ======================================
// Corporate Girlie — frontend logic
// Phase 2: UI interactions, no API yet
// ======================================

// -- Elements --
const btnGenerate   = document.getElementById('btn-generate');
const btnReframe    = document.getElementById('btn-reframe');
const topicSection  = document.getElementById('topic-section');
const reframeSection = document.getElementById('reframe-section');
const reframeInput  = document.getElementById('reframe-input');
const charCount     = document.getElementById('char-count');
const submitBtn     = document.getElementById('submit-btn');
const btnText       = document.getElementById('btn-text');
const btnLoading    = document.getElementById('btn-loading');
const outputArea    = document.getElementById('output-area');

// -- Mode state --
let currentMode = 'generate';

// -- Mode toggle --
btnGenerate.addEventListener('click', () => setMode('generate'));
btnReframe.addEventListener('click', () => setMode('reframe'));

function setMode(mode) {
  currentMode = mode;

  const isGenerate = mode === 'generate';

  btnGenerate.classList.toggle('active', isGenerate);
  btnGenerate.setAttribute('aria-pressed', String(isGenerate));

  btnReframe.classList.toggle('active', !isGenerate);
  btnReframe.setAttribute('aria-pressed', String(!isGenerate));

  topicSection.hidden  = !isGenerate;
  reframeSection.hidden = isGenerate;

  btnText.textContent = isGenerate ? 'Generate ✨' : 'Reframe 💄';
}

// -- Character counter (reframe textarea) --
reframeInput.addEventListener('input', () => {
  charCount.textContent = reframeInput.value.length;
});

// ======================================
// Submit — calls /api/generate
// ======================================

submitBtn.addEventListener('click', handleSubmit);

async function handleSubmit() {
  setLoading(true);

  // Build the request body based on current mode
  const input = currentMode === 'reframe'
    ? reframeInput.value.trim()
    : document.getElementById('topic-input').value.trim();

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: currentMode, input }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Server returned a friendly error message
      addCard(data.error || "the mirror's a little foggy — try again in a sec");
    } else {
      addCard(data.phrase);
    }
  } catch (err) {
    // Network error or JSON parse failure
    addCard("the mirror's a little foggy — try again in a sec");
  }

  setLoading(false);
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.hidden     = loading;
  btnLoading.hidden  = !loading;
}

// ======================================
// Phrase card — adds a new card to the
// top of the output area with animation.
// ======================================

function addCard(phrase) {
  const card = document.createElement('div');
  card.className = 'phrase-card';

  const p = document.createElement('p');
  p.className = 'phrase-text';
  p.textContent = phrase; // textContent = safe, no XSS risk

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy-btn';
  btn.setAttribute('aria-label', 'Copy phrase');
  btn.textContent = 'Copy';
  btn.addEventListener('click', () => copyPhrase(phrase, btn));

  card.appendChild(p);
  card.appendChild(btn);

  // Newest card goes on top
  outputArea.insertBefore(card, outputArea.firstChild);
}

// ======================================
// Copy to clipboard
// ======================================

function copyPhrase(phrase, btn) {
  navigator.clipboard.writeText(phrase)
    .then(() => showCopied(btn))
    .catch(() => showCopied(btn)); // still give feedback even if clipboard fails
}

function showCopied(btn) {
  btn.textContent = 'copied! ✨';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = 'Copy';
    btn.classList.remove('copied');
  }, 1500);
}

// Wire up copy buttons on the three hardcoded sample cards in the HTML
document.querySelectorAll('.phrase-card').forEach(card => {
  const phrase  = card.querySelector('.phrase-text').textContent;
  const copyBtn = card.querySelector('.copy-btn');
  copyBtn.addEventListener('click', () => copyPhrase(phrase, copyBtn));
});
