import { PROMPT_VERSION } from './prompt.js';

// ======================================
// Test cases — ~20 across both modes
// ======================================

const TEST_CASES = [
  // Generate mode — full sentences a user would actually type as a topic hint
  {
    mode: 'generate',
    label: 'Going in circles',
    input: 'we\'ve been debating the same decision for three weeks and nothing is moving',
  },
  {
    mode: 'generate',
    label: 'No headcount',
    input: 'I have to tell my team we\'re not getting the additional headcount we asked for',
  },
  {
    mode: 'generate',
    label: 'Shifting priorities',
    input: 'leadership keeps changing the priorities mid-sprint and the team is frustrated',
  },
  {
    mode: 'generate',
    label: 'Not launch-ready',
    input: 'we\'re supposed to launch next week but the product still has too many rough edges',
  },
  {
    mode: 'generate',
    label: 'Architecture fight',
    input: 'two senior engineers fundamentally disagree on the technical approach and it\'s blocking the whole team',
  },
  {
    mode: 'generate',
    label: 'Client scope creep',
    input: 'the client keeps adding requirements without adjusting the timeline or budget',
  },
  {
    mode: 'generate',
    label: 'Crunch for months',
    input: 'the team has been in crunch mode for two months and morale is tanking',
  },
  {
    mode: 'generate',
    label: 'Cut features',
    input: 'we have to cut features before launch but we can\'t agree on which ones to cut',
  },
  {
    mode: 'generate',
    label: 'Strategy too cautious',
    input: 'we got feedback that our roadmap is too conservative and we need to take bigger swings',
  },
  {
    mode: 'generate',
    label: 'Behind on everything',
    input: 'we are three sprints behind and the big stakeholder review is tomorrow morning',
  },

  // Reframe mode — full sentences someone would paste in
  {
    mode: 'reframe',
    label: 'Move faster',
    input: 'we need to move faster, this pace is not acceptable',
  },
  {
    mode: 'reframe',
    label: 'No alignment',
    input: 'I don\'t think we have alignment on the direction yet and we keep relitigating the same points',
  },
  {
    mode: 'reframe',
    label: 'Performance issue',
    input: 'this person is not performing at the level we need and we\'ve been avoiding the conversation',
  },
  {
    mode: 'reframe',
    label: 'Over-engineered',
    input: 'this solution is way over-engineered for what we actually need to ship',
  },
  {
    mode: 'reframe',
    label: 'Too many meetings',
    input: 'we\'re spending too much time in meetings and not enough time doing actual work',
  },
  {
    mode: 'reframe',
    label: 'Will miss deadline',
    input: 'I need everyone to know we are going to miss the deadline',
  },
  {
    mode: 'reframe',
    label: 'Users not engaging',
    input: 'the data shows our users are not engaging with this feature the way we expected',
  },
  {
    mode: 'reframe',
    label: 'Been in dev too long',
    input: 'this feature has been in development for six months and it\'s still not done',
  },
  {
    mode: 'reframe',
    label: 'Covering up problems',
    input: 'I feel like we keep presenting things as fine when they\'re not actually fine',
  },
  {
    mode: 'reframe',
    label: 'Starting over',
    input: 'I think we need to scrap what we have and start from scratch',
  },
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
      </div>
      <div class="eval-input-sentence">${tc.input}</div>
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
  btn.textContent = 'Run All';
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
