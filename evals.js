import { PROMPT_VERSION } from './prompt.js';

// ======================================
// Test cases — ~20 across both modes
// ======================================

const TEST_CASES = [
  // Generate mode
  { mode: 'generate', label: 'Morning standup',         input: 'morning standup' },
  { mode: 'generate', label: 'Deadline pressure',       input: 'deadline pressure' },
  { mode: 'generate', label: 'Scope creep',             input: 'scope creep' },
  { mode: 'generate', label: 'Firing someone',          input: 'firing someone' },
  { mode: 'generate', label: 'Giving feedback',         input: 'giving feedback' },
  { mode: 'generate', label: 'Team is burnt out',       input: 'team is burnt out' },
  { mode: 'generate', label: 'Launch is slipping',      input: 'launch is slipping' },
  { mode: 'generate', label: 'Need more budget',        input: 'need more budget' },
  { mode: 'generate', label: 'Two teams disagree',      input: 'two teams disagree' },
  { mode: 'generate', label: 'Hiring freeze',           input: 'hiring freeze' },
  { mode: 'generate', label: 'Stakeholder pressure',    input: 'stakeholder presentation pressure' },
  { mode: 'generate', label: 'Over-engineered',         input: 'project is over-engineered' },
  { mode: 'generate', label: 'Team needs alignment',    input: 'team needs alignment' },

  // Reframe mode
  { mode: 'reframe', label: 'Fix before launch',        input: 'we need to fix this before launch' },
  { mode: 'reframe', label: 'Data doesn\'t support it', input: 'the data doesn\'t support that conclusion' },
  { mode: 'reframe', label: 'Revisit next quarter',     input: 'can we revisit this next quarter' },
  { mode: 'reframe', label: 'Team underperforming',     input: 'this team is underperforming' },
  { mode: 'reframe', label: 'Need more resources',      input: 'we need more resources to do this properly' },
  { mode: 'reframe', label: 'Taking too long',          input: 'this is taking too long' },
  { mode: 'reframe', label: 'Strategy keeps changing',  input: 'the strategy keeps changing' },
];

// ======================================
// localStorage helpers
// ======================================

function ratingKey(version, input) {
  return `cg_${version}_${input}`;
}

function getRating(input, version = PROMPT_VERSION) {
  return localStorage.getItem(ratingKey(version, input)); // 'up' | 'down' | null
}

function setRating(input, value) {
  localStorage.setItem(ratingKey(PROMPT_VERSION, input), value);
  updateSummary();
}

function getPastVersions() {
  const versions = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cg_')) {
      const parts = key.split('_');
      if (parts.length >= 3) versions.add(parts[1]); // cg_<version>_<input>
    }
  }
  versions.delete(PROMPT_VERSION); // current version shown separately
  return [...versions].sort();
}

// ======================================
// Summary line
// ======================================

function updateSummary(version = PROMPT_VERSION) {
  let up = 0, down = 0, total = 0;

  TEST_CASES.forEach(({ input }) => {
    const r = getRating(input, version);
    if (r === 'up')   { up++;   total++; }
    if (r === 'down') { down++; total++; }
  });

  const summaryEl = document.getElementById('summary-line');
  if (total === 0) {
    summaryEl.textContent = 'run all cases to start rating';
  } else {
    summaryEl.textContent = `${version}: ${up} 👍 / ${down} 👎 (${total} rated of ${TEST_CASES.length})`;
  }
}

// ======================================
// Card rendering
// ======================================

function renderCards() {
  const grid = document.getElementById('results-grid');
  grid.innerHTML = '';

  TEST_CASES.forEach((tc) => {
    const card = document.createElement('div');
    card.className = 'eval-card';
    card.id = `card-${tc.input.replace(/\s+/g, '-')}`;

    const existingRating = getRating(tc.input);

    card.innerHTML = `
      <div class="eval-card-top">
        <span class="eval-badge ${tc.mode}">${tc.mode}</span>
        <span class="eval-input">${tc.label}</span>
      </div>
      <div class="eval-output pending" id="output-${cardId(tc.input)}">not run yet</div>
      <div class="eval-card-bottom">
        <button class="rating-btn ${existingRating === 'up' ? 'selected-up' : ''}"
                id="up-${cardId(tc.input)}"
                data-input="${tc.input}"
                data-dir="up"
                ${existingRating ? '' : 'disabled'}>👍</button>
        <button class="rating-btn ${existingRating === 'down' ? 'selected-down' : ''}"
                id="down-${cardId(tc.input)}"
                data-input="${tc.input}"
                data-dir="down"
                ${existingRating ? '' : 'disabled'}>👎</button>
      </div>
    `;

    grid.appendChild(card);
  });

  // Wire up rating buttons
  grid.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.dataset.input;
      const dir   = btn.dataset.dir;
      setRating(input, dir);
      applyRatingUI(input, dir);
    });
  });
}

function cardId(input) {
  return input.replace(/[^a-z0-9]/gi, '-');
}

function applyRatingUI(input, dir) {
  const upBtn   = document.getElementById(`up-${cardId(input)}`);
  const downBtn = document.getElementById(`down-${cardId(input)}`);
  if (!upBtn || !downBtn) return;

  upBtn.classList.toggle('selected-up',   dir === 'up');
  downBtn.classList.toggle('selected-down', dir === 'down');
  upBtn.disabled   = false;
  downBtn.disabled = false;
}

function setCardOutput(input, text, isError = false) {
  const el = document.getElementById(`output-${cardId(input)}`);
  if (!el) return;
  el.className = 'eval-output' + (isError ? ' pending' : '');
  el.textContent = text;

  // Enable rating buttons once we have output
  const upBtn   = document.getElementById(`up-${cardId(input)}`);
  const downBtn = document.getElementById(`down-${cardId(input)}`);
  if (upBtn)   upBtn.disabled   = false;
  if (downBtn) downBtn.disabled = false;

  // Restore saved rating if any
  const saved = getRating(input);
  if (saved) applyRatingUI(input, saved);
}

// ======================================
// Run all
// ======================================

async function runAll() {
  const btn = document.getElementById('run-all-btn');
  btn.disabled = true;
  btn.textContent = 'Running...';

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];

    // Show loading state
    const el = document.getElementById(`output-${cardId(tc.input)}`);
    if (el) { el.className = 'eval-output loading'; el.textContent = '✦ generating...'; }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: tc.mode, input: tc.input }),
      });
      const data = await res.json();
      setCardOutput(tc.input, res.ok ? data.phrase : (data.error || 'error'));
    } catch {
      setCardOutput(tc.input, 'network error', true);
    }

    // Stagger requests — 300ms apart so we don't hammer the function
    if (i < TEST_CASES.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  btn.disabled = false;
  btn.textContent = 'Run All 20';
  updateSummary();
}

// ======================================
// Past version dropdown
// ======================================

function populateVersionDropdown() {
  const select = document.getElementById('version-select');
  const past = getPastVersions();
  past.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    const v = select.value;
    if (v) updateSummary(v);
    else   updateSummary();
  });
}

// ======================================
// Init
// ======================================

document.getElementById('version-label').textContent = `prompt version: ${PROMPT_VERSION}`;

renderCards();
updateSummary();
populateVersionDropdown();

document.getElementById('run-all-btn').addEventListener('click', runAll);
