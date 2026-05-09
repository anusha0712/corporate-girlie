// ======================================
// Corporate Girlie — DEMO mode
// ======================================
// First N clicks come from the curated list below (vetted, safe for stage).
// After the curated queue is exhausted, falls back to the live /api/generate.
// Edit CURATED_PHRASES to add/remove/reorder phrases for an event.
// ======================================

// --- Curated phrase list ---
// Sourced from prompt.js canonical examples + phrases rated "good" in
// eval-sessions/latest.json. Edit freely before an event.
//
// `theme` is a short tag for the beauty domain. The shuffler below avoids
// placing two phrases with the same theme back-to-back so the demo doesn't
// feel like 8 variations of the same idea.
const CURATED_PHRASES = [
  {
    theme: "dry-shampoo",
    phrase: "We can't dry shampoo our way out of this.",
    usage: "Use this when a quick cosmetic fix is being substituted for the real work the situation requires.",
  },
  {
    theme: "concealer",
    phrase: "Are we color correcting or just concealing?",
    usage: "Use this to challenge whether a solution addresses the root issue or just makes it less visible.",
  },
  {
    theme: "pressed-powder",
    phrase: "We're hitting pan on the budget.",
    usage: "Use this when budget, runway, or goodwill is close to gone and the bottom is becoming visible.",
  },
  {
    theme: "blending",
    phrase: "We're over-blending. Step back.",
    usage: "Use this when continued iteration is actively degrading the work rather than improving it.",
  },
  {
    theme: "palette",
    phrase: "We keep changing the palette halfway through the look.",
    usage: "Use this when shifting priorities mid-execution are forcing the team to undo finished work and start over.",
  },
  {
    theme: "cuticles",
    phrase: "We can't launch with our cuticles looking like this.",
    usage: "Use this when a ship date is looming but the product is visibly unfinished.",
  },
  {
    theme: "setting-powder",
    phrase: "We've been buffing this for three weeks. At some point you have to set the powder.",
    usage: "Use this when a team has spent too long refining a decision and needs to commit and move forward.",
  },
  {
    theme: "glam-budget",
    phrase: "They want full glam on a tinted moisturizer budget.",
    usage: "Use this when a client is requesting a high-effort, high-complexity deliverable without adjusting the resources to match.",
  },
  {
    theme: "gel-polish",
    phrase: "Gel top coat over uncured polish — it's going to lift.",
    usage: "Use this when a team is trying to seal and present work that hasn't been given enough time to set, warning that the result won't hold.",
  },
  {
    theme: "blowout",
    phrase: "We keep changing the part and then wondering why the blowout won't hold.",
    usage: "Use this when repeated last-minute direction changes are preventing the team from executing cleanly on anything.",
  },
  {
    theme: "full-beat-clock",
    phrase: "We're doing a full beat with twenty minutes on the clock.",
    usage: "Use this when the team is severely behind with a high-stakes deadline imminent and needs to move fast without pretending there is more time than there is.",
  },
  {
    theme: "mirror",
    phrase: "This look isn't getting better by staring at it in the mirror.",
    usage: "Use this when a team keeps revisiting a decision without new information, and the deliberation itself has become the blocker.",
  },
];

// --- Elements ---
const submitBtn      = document.getElementById('submit-btn');
const btnText        = document.getElementById('btn-text');
const btnLoading     = document.getElementById('btn-loading');
const topicInput     = document.getElementById('topic-input');

const generateOutput = document.getElementById('generate-output');
const currentPhrase  = document.getElementById('current-phrase');
const currentUsage   = document.getElementById('current-usage');
const copyCurrent    = document.getElementById('copy-current-btn');
const saveBtn        = document.getElementById('save-btn');

const savedSection   = document.getElementById('saved-section');
const savedToggleBtn = document.getElementById('saved-toggle-btn');
const savedCountEl   = document.getElementById('saved-count');
const savedList      = document.getElementById('saved-list');
const copyAllBtn     = document.getElementById('copy-all-btn');

const arsenalModal   = document.getElementById('arsenal-modal');
const arsenalBackdrop= document.getElementById('arsenal-backdrop');
const arsenalCloseBtn= document.getElementById('arsenal-close-btn');

// --- State ---
let savedPhrases     = [];
let recentPhrases    = [];
let recentCategories = [];

// Shuffle the curated list once on load so each demo session orders differently.
// Same rotation rule as the live API: no two adjacent phrases share a theme.
let demoQueue = shuffleNoAdjacentTheme([...CURATED_PHRASES]);

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Random shuffle, then walk the array and swap any back-to-back same-theme
// items with a later item that fixes the adjacency. Up to 50 reshuffle attempts
// before falling back to a greedy single-pass repair.
function shuffleNoAdjacentTheme(arr) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = shuffleInPlace([...arr]);
    if (!hasAdjacentTheme(candidate)) return candidate;
  }
  // Greedy repair fallback
  const result = shuffleInPlace([...arr]);
  for (let i = 1; i < result.length; i++) {
    if (result[i].theme === result[i - 1].theme) {
      for (let j = i + 1; j < result.length; j++) {
        const swapOk =
          result[j].theme !== result[i - 1].theme &&
          (j + 1 >= result.length || result[j + 1].theme !== result[i].theme);
        if (swapOk) {
          [result[i], result[j]] = [result[j], result[i]];
          break;
        }
      }
    }
  }
  return result;
}

function hasAdjacentTheme(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].theme === arr[i - 1].theme) return true;
  }
  return false;
}

// ======================================
// Submit
// ======================================

submitBtn.addEventListener('click', handleSubmit);

async function handleSubmit() {
  setLoading(true);

  if (demoQueue.length > 0) {
    // Curated path — pop next phrase, simulate generate latency
    const next = demoQueue.shift();
    await new Promise(r => setTimeout(r, 600));
    showCurrentPhrase(next.phrase, next.usage);
    setLoading(false);
    return;
  }

  // Fallback: real API once curated queue is empty
  const input = topicInput.value.trim();
  try {
    const body = { mode: 'generate', input };
    if (recentPhrases.length > 0)    body.recentPhrases    = recentPhrases.slice(-3);
    if (recentCategories.length > 0) body.recentCategories = recentCategories.slice(-10);

    const res  = await fetch('/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      showCurrentPhrase(data.error || "the mirror's a little foggy — try again in a sec", '');
    } else {
      recentPhrases.push(data.phrase);
      if (recentPhrases.length > 3) recentPhrases.shift();
      if (data.category) {
        recentCategories.push(data.category);
        if (recentCategories.length > 10) recentCategories.shift();
      }
      showCurrentPhrase(data.phrase, data.usage || '');
    }
  } catch {
    showCurrentPhrase("the mirror's a little foggy — try again in a sec", '');
  }

  setLoading(false);
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.hidden     = loading;
  btnLoading.hidden  = !loading;
}

// ======================================
// Current phrase display
// ======================================

function showCurrentPhrase(phrase, usage) {
  currentPhrase.textContent = phrase;
  currentUsage.textContent  = usage;
  currentUsage.hidden       = !usage;

  generateOutput.hidden = false;
  document.body.classList.add('has-output');

  saveBtn.textContent = 'Save';
  saveBtn.disabled    = false;
  saveBtn.classList.remove('saved');

  copyCurrent.onclick = () => copyPhrase(phrase, copyCurrent);
  saveBtn.onclick     = () => savePhraseToList(phrase, usage);
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
