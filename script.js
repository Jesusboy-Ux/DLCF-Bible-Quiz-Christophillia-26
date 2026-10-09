/**
 * DLCF UNN BIBLE QUIZ APPLICATION - CHRISTOPHILIA
 * Pure Vanilla JavaScript implementation
 */

// STATE MANAGEMENT
const STATE_KEY = 'dlcf_unn_quiz_state_v1';

let appState = {
  questions: [],
  candidates: [],
  currentQuestionIndex: -1,
  quizStatus: 'Not Started', // 'Not Started', 'Running', 'Paused', 'Ended'
  timeRemaining: 35 * 60, // 35 minutes default
  scoreHistory: [] // Stack for undo functionality: { candidateId, timestamp }
};

let timerInterval = null;

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromLocalStorage();
  initUIEventListeners();
  renderAll();
});

// LOCAL STORAGE PERSISTENCE
function saveStateToLocalStorage() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
}

function loadStateFromLocalStorage() {
  const saved = localStorage.getItem(STATE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      appState = { ...appState, ...parsed };
    } catch (e) {
      console.error('Failed to parse localStorage data', e);
    }
  }
}

// UTILITY FUNCTIONS
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// RENDERERS
function renderAll() {
  renderBadges();
  renderQuestionsList();
  renderCandidatesList();
  renderCandidateDropdown();
  renderQuestionDisplay();
  renderLeaderboard();
  renderControlsState();
}

function renderBadges() {
  document.getElementById('q-count-badge').textContent = appState.questions.length;
  document.getElementById('c-count-badge').textContent = appState.candidates.length;
}

function renderControlsState() {
  const statusText = document.getElementById('quiz-status-text');
  const timerText = document.getElementById('quiz-timer-text');
  const projBadge = document.getElementById('projector-status-badge');

  statusText.textContent = appState.quizStatus;
  projBadge.textContent = appState.quizStatus.toUpperCase();
  timerText.textContent = formatTime(appState.timeRemaining);

  const startBtn = document.getElementById('btn-start-quiz');
  const pauseBtn = document.getElementById('btn-pause-quiz');
  const resumeBtn = document.getElementById('btn-resume-quiz');
  const endBtn = document.getElementById('btn-end-quiz');
  const undoBtn = document.getElementById('btn-undo-score');

  undoBtn.disabled = appState.scoreHistory.length === 0;

  if (appState.quizStatus === 'Not Started') {
    startBtn.style.display = 'inline-flex';
    pauseBtn.style.display = 'inline-flex';
    pauseBtn.disabled = true;
    resumeBtn.style.display = 'none';
    endBtn.disabled = true;
  } else if (appState.quizStatus === 'Running') {
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-flex';
    pauseBtn.disabled = false;
    resumeBtn.style.display = 'none';
    endBtn.disabled = false;
  } else if (appState.quizStatus === 'Paused') {
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'inline-flex';
    endBtn.disabled = false;
  } else if (appState.quizStatus === 'Ended') {
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-flex';
    pauseBtn.disabled = true;
    resumeBtn.style.display = 'none';
    endBtn.disabled = true;
  }

  // Update navigation button indicator
  const navIndicator = document.getElementById('q-nav-indicator');
  const total = appState.questions.length;
  const current = total === 0 ? 0 : appState.currentQuestionIndex + 1;
  navIndicator.textContent = `Question ${current} of ${total}`;
}

function renderQuestionsList() {
  const listEl = document.getElementById('questions-list');
  if (appState.questions.length === 0) {
    listEl.innerHTML = '<p class="empty-msg">No questions added yet. Add your first question above.</p>';
    return;
  }

  listEl.innerHTML = appState.questions.map((q, idx) => `
    <div class="list-item">
      <div class="list-item-info">
        <div class="list-item-title">${idx + 1}. ${escapeHTML(q.text)}</div>
        <div class="list-item-subtitle">${escapeHTML(q.category)} | ${q.type.toUpperCase()}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-outline btn-sm" onclick="moveQuestion(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn btn-outline btn-sm" onclick="moveQuestion(${idx}, 1)" ${idx === appState.questions.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="btn btn-outline-primary btn-sm" onclick="editQuestion(${q.id})">Edit</button>
        <button class="btn btn-outline-danger btn-sm" onclick="deleteQuestion(${q.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderCandidatesList() {
  const listEl = document.getElementById('candidates-list');
  if (appState.candidates.length === 0) {
    listEl.innerHTML = '<p class="empty-msg">No candidates registered yet.</p>';
    return;
  }

  listEl.innerHTML = appState.candidates.map((c) => `
    <div class="list-item">
      <div class="list-item-info">
        <div class="list-item-title">${escapeHTML(c.name)}</div>
        <div class="list-item-subtitle">Score: ${c.score} points</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-outline-primary btn-sm" onclick="editCandidate(${c.id})">Edit</button>
        <button class="btn btn-outline-danger btn-sm" onclick="deleteCandidate(${c.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderCandidateDropdown() {
  const select = document.getElementById('award-candidate-select');
  const currentVal = select.value;
  
  select.innerHTML = '<option value="">-- Select Candidate --</option>' +
    appState.candidates.map(c => `
      <option value="${c.id}">${escapeHTML(c.name)} (${c.score} pts)</option>
    `).join('');

  select.value = currentVal;
}

function renderQuestionDisplay() {
  const catEl = document.getElementById('disp-q-category');
  const numEl = document.getElementById('disp-q-number');
  const textEl = document.getElementById('disp-q-text');
  const optsEl = document.getElementById('disp-q-options');

  if (appState.questions.length === 0) {
    catEl.textContent = 'Category: None';
    numEl.textContent = 'Question 0 / 0';
    textEl.textContent = 'No questions available in the question bank. Please add questions using the operator panel.';
    optsEl.innerHTML = '';
    return;
  }

  if (appState.currentQuestionIndex < 0) {
    appState.currentQuestionIndex = 0;
  }

  const q = appState.questions[appState.currentQuestionIndex];
  if (!q) return;

  catEl.textContent = `Category: ${q.category}`;
  numEl.textContent = `Question ${appState.currentQuestionIndex + 1} / ${appState.questions.length}`;
  textEl.textContent = q.text;

  // Render options safely WITHOUT exposing correct answers
  if (q.type === 'mcq' && q.options) {
    const letters = ['A', 'B', 'C', 'D'];
    optsEl.innerHTML = q.options
      .filter(opt => opt && opt.trim() !== '')
      .map((opt, idx) => `
        <div class="option-card">
          <span class="option-prefix">${letters[idx]}</span>
          <span>${escapeHTML(opt)}</span>
        </div>
      `).join('');
  } else {
    optsEl.innerHTML = '<div class="option-card" style="grid-column: 1 / -1; justify-content: center; color: #666;"><em>Short Answer Question — Candidates speak answer directly to Quizmaster</em></div>';
  }
}

function getSortedCandidates() {
  // Return shallow copy sorted by score descending, preserving order for ties
  return [...appState.candidates].sort((a, b) => b.score - a.score);
}

function renderLeaderboard() {
  const body = document.getElementById('leaderboard-body');
  const sorted = getSortedCandidates();

  if (sorted.length === 0) {
    body.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No candidate scores recorded yet.</td></tr>';
    return;
  }

  let currentRank = 0;
  let previousScore = null;

  body.innerHTML = sorted.map((c, idx) => {
    if (c.score !== previousScore) {
      currentRank = idx + 1;
      previousScore = c.score;
    }

    let rankClass = '';
    if (currentRank === 1) rankClass = 'rank-1';
    else if (currentRank === 2) rankClass = 'rank-2';
    else if (currentRank === 3) rankClass = 'rank-3';

    return `
      <tr>
        <td><span class="rank-badge ${rankClass}">#${currentRank}</span></td>
        <td><strong>${escapeHTML(c.name)}</strong></td>
        <td class="text-right"><strong>${c.score}</strong></td>
      </tr>
    `;
  }).join('');
}

// EVENT LISTENERS & LOGIC
function initUIEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      e.target.classList.add('active');
      document.getElementById(e.target.dataset.tab).classList.add('active');
    });
  });

  // MCQ Type Toggle
  document.getElementById('q-type').addEventListener('change', (e) => {
    const mcqBox = document.getElementById('mcq-options-container');
    mcqBox.style.display = e.target.value === 'mcq' ? 'block' : 'none';
  });

  // Question Form Submission
  document.getElementById('question-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveQuestionFromForm();
  });

  document.getElementById('btn-cancel-q-edit').addEventListener('click', resetQuestionForm);

  // Candidate Form Submission
  document.getElementById('candidate-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveCandidateFromForm();
  });

  document.getElementById('btn-cancel-c-edit').addEventListener('click', resetCandidateForm);

  // Award Point
  document.getElementById('btn-award-point').addEventListener('click', awardPoint);
  document.getElementById('btn-undo-score').addEventListener('click', undoLastScore);

  // Question Navigation
  document.getElementById('btn-prev-q').addEventListener('click', () => {
    if (appState.currentQuestionIndex > 0) {
      appState.currentQuestionIndex--;
      saveStateToLocalStorage();
      renderAll();
    }
  });

  document.getElementById('btn-next-q').addEventListener('click', () => {
    if (appState.currentQuestionIndex < appState.questions.length - 1) {
      appState.currentQuestionIndex++;
      saveStateToLocalStorage();
      renderAll();
    }
  });

  // Session Controls
  document.getElementById('btn-start-quiz').addEventListener('click', startQuiz);
  document.getElementById('btn-pause-quiz').addEventListener('click', pauseQuiz);
  document.getElementById('btn-resume-quiz').addEventListener('click', resumeQuiz);
  document.getElementById('btn-end-quiz').addEventListener('click', endQuiz);
  document.getElementById('btn-reset-quiz').addEventListener('click', resetQuiz);

  // Backup & Restore
  document.getElementById('btn-export-backup').addEventListener('click', exportJSONBackup);
  document.getElementById('import-file-input').addEventListener('change', importJSONBackup);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSVResults);
  document.getElementById('btn-modal-export-csv').addEventListener('click', exportCSVResults);

  // Projector Toggle
  document.getElementById('toggle-projector-btn').addEventListener('click', toggleProjectorMode);

  // Close Final Modal
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('final-results-modal').style.display = 'none';
  });
}

// QUESTION MANAGEMENT
function saveQuestionFromForm() {
  const editId = document.getElementById('q-edit-id').value;
  const category = document.getElementById('q-category').value;
  const type = document.getElementById('q-type').value;
  const text = document.getElementById('q-text').value.trim();
  const answerKey = document.getElementById('q-answer-key').value.trim();

  if (!text) return;

  const options = type === 'mcq' ? [
    document.getElementById('q-opt-a').value.trim(),
    document.getElementById('q-opt-b').value.trim(),
    document.getElementById('q-opt-c').value.trim(),
    document.getElementById('q-opt-d').value.trim()
  ] : [];

  if (editId) {
    const index = appState.questions.findIndex(q => q.id === parseInt(editId));
    if (index !== -1) {
      appState.questions[index] = { id: parseInt(editId), category, type, text, options, answerKey };
    }
  } else {
    const newQ = {
      id: Date.now(),
      category,
      type,
      text,
      options,
      answerKey
    };
    appState.questions.push(newQ);
    if (appState.currentQuestionIndex === -1) {
      appState.currentQuestionIndex = 0;
    }
  }

  saveStateToLocalStorage();
  resetQuestionForm();
  renderAll();
}

function editQuestion(id) {
  const q = appState.questions.find(item => item.id === id);
  if (!q) return;

  document.getElementById('q-edit-id').value = q.id;
  document.getElementById('q-category').value = q.category;
  document.getElementById('q-type').value = q.type;
  document.getElementById('q-text').value = q.text;
  document.getElementById('q-answer-key').value = q.answerKey || '';

  const mcqBox = document.getElementById('mcq-options-container');
  if (q.type === 'mcq') {
    mcqBox.style.display = 'block';
    document.getElementById('q-opt-a').value = q.options[0] || '';
    document.getElementById('q-opt-b').value = q.options[1] || '';
    document.getElementById('q-opt-c').value = q.options[2] || '';
    document.getElementById('q-opt-d').value = q.options[3] || '';
  } else {
    mcqBox.style.display = 'none';
  }

  document.getElementById('question-form-title').textContent = 'Edit Question';
  document.getElementById('btn-save-question').textContent = 'Update Question';
  document.getElementById('btn-cancel-q-edit').style.display = 'inline-flex';
}

function resetQuestionForm() {
  document.getElementById('q-edit-id').value = '';
  document.getElementById('question-form').reset();
  document.getElementById('question-form-title').textContent = 'Add New Question';
  document.getElementById('btn-save-question').textContent = 'Save Question';
  document.getElementById('btn-cancel-q-edit').style.display = 'none';
  document.getElementById('mcq-options-container').style.display = 'block';
}

function deleteQuestion(id) {
  if (confirm('Are you sure you want to delete this question?')) {
    appState.questions = appState.questions.filter(q => q.id !== id);
    if (appState.currentQuestionIndex >= appState.questions.length) {
      appState.currentQuestionIndex = Math.max(0, appState.questions.length - 1);
    }
    saveStateToLocalStorage();
    renderAll();
  }
}

function moveQuestion(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= appState.questions.length) return;

  const temp = appState.questions[index];
  appState.questions[index] = appState.questions[newIndex];
  appState.questions[newIndex] = temp;

  saveStateToLocalStorage();
  renderAll();
}

// CANDIDATE MANAGEMENT
function saveCandidateFromForm() {
  const editId = document.getElementById('c-edit-id').value;
  const name = document.getElementById('c-name').value.trim();

  if (!name) return;

  if (editId) {
    const candidate = appState.candidates.find(c => c.id === parseInt(editId));
    if (candidate) candidate.name = name;
  } else {
    appState.candidates.push({
      id: Date.now(),
      name: name,
      score: 0
    });
  }

  saveStateToLocalStorage();
  resetCandidateForm();
  renderAll();
}

function editCandidate(id) {
  const candidate = appState.candidates.find(c => c.id === id);
  if (!candidate) return;

  document.getElementById('c-edit-id').value = candidate.id;
  document.getElementById('c-name').value = candidate.name;
  document.getElementById('btn-save-candidate').textContent = 'Update Candidate';
  document.getElementById('btn-cancel-c-edit').style.display = 'inline-flex';
}

function resetCandidateForm() {
  document.getElementById('c-edit-id').value = '';
  document.getElementById('candidate-form').reset();
  document.getElementById('btn-save-candidate').textContent = 'Add Candidate';
  document.getElementById('btn-cancel-c-edit').style.display = 'none';
}

function deleteCandidate(id) {
  if (confirm('Are you sure you want to remove this candidate?')) {
    appState.candidates = appState.candidates.filter(c => c.id !== id);
    saveStateToLocalStorage();
    renderAll();
  }
}

// SCORING
function awardPoint() {
  const candidateId = parseInt(document.getElementById('award-candidate-select').value);
  if (!candidateId) {
    alert('Please select a candidate first.');
    return;
  }

  const candidate = appState.candidates.find(c => c.id === candidateId);
  if (candidate) {
    candidate.score += 1;
    appState.scoreHistory.push({ candidateId: candidate.id, timestamp: Date.now() });
    saveStateToLocalStorage();
    renderAll();
  }
}

function undoLastScore() {
  if (appState.scoreHistory.length === 0) return;

  const lastAction = appState.scoreHistory.pop();
  const candidate = appState.candidates.find(c => c.id === lastAction.candidateId);

  if (candidate && candidate.score > 0) {
    candidate.score -= 1;
    saveStateToLocalStorage();
    renderAll();
  }
}

// TIMER & SESSION CONTROLS
function startQuiz() {
  if (appState.questions.length === 0) {
    alert('Please add at least one question before starting.');
    return;
  }
  appState.quizStatus = 'Running';
  startTimer();
  saveStateToLocalStorage();
  renderAll();
}

function pauseQuiz() {
  appState.quizStatus = 'Paused';
  clearInterval(timerInterval);
  saveStateToLocalStorage();
  renderAll();
}

function resumeQuiz() {
  appState.quizStatus = 'Running';
  startTimer();
  saveStateToLocalStorage();
  renderAll();
}

function endQuiz() {
  if (confirm('Are you sure you want to end the quiz session?')) {
    appState.quizStatus = 'Ended';
    clearInterval(timerInterval);
    saveStateToLocalStorage();
    renderAll();
    showFinalResultsModal();
  }
}

function resetQuiz() {
  if (confirm('Reset quiz state and reset all candidate scores to 0? This cannot be undone.')) {
    clearInterval(timerInterval);
    appState.quizStatus = 'Not Started';
    appState.timeRemaining = 35 * 60;
    appState.currentQuestionIndex = 0;
    appState.scoreHistory = [];
    appState.candidates.forEach(c => c.score = 0);
    saveStateToLocalStorage();
    renderAll();
  }
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (appState.timeRemaining > 0) {
      appState.timeRemaining--;
      renderControlsState();
      saveStateToLocalStorage();
    } else {
      clearInterval(timerInterval);
      appState.quizStatus = 'Ended';
      saveStateToLocalStorage();
      renderAll();
      showFinalResultsModal();
    }
  }, 1000);
}

function showFinalResultsModal() {
  const container = document.getElementById('final-leaderboard-container');
  const sorted = getSortedCandidates();

  if (sorted.length === 0) {
    container.innerHTML = '<p>No candidates were registered.</p>';
  } else {
    container.innerHTML = `
      <table class="leaderboard-table" style="margin-top: 1rem;">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Candidate Name</th>
            <th class="text-right">Final Score</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((c, i) => `
            <tr>
              <td><strong>#${i + 1}</strong></td>
              <td>${escapeHTML(c.name)}</td>
              <td class="text-right"><strong>${c.score} pts</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  document.getElementById('final-results-modal').style.display = 'flex';
}

// BACKUP & EXPORT
function exportJSONBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `DLCF_UNN_Quiz_Backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function importJSONBackup(e) {
  const fileReader = new FileReader();
  fileReader.onload = function (event) {
    try {
      const parsed = JSON.parse(event.target.result);
      if (confirm('Importing backup will replace all current data. Proceed?')) {
        appState = parsed;
        saveStateToLocalStorage();
        renderAll();
        alert('Backup successfully restored!');
      }
    } catch (err) {
      alert('Invalid JSON backup file.');
    }
  };
  if (e.target.files[0]) {
    fileReader.readAsText(e.target.files[0]);
  }
}

function exportCSVResults() {
  const sorted = getSortedCandidates();
  if (sorted.length === 0) {
    alert('No candidate results available to export.');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,Rank,Candidate Name,Score\n";
  sorted.forEach((c, index) => {
    csvContent += `${index + 1},"${c.name.replace(/"/g, '""')}",${c.score}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `CHRISTOPHILIA_Quiz_Results_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// PROJECTOR FULLSCREEN TOGGLE
function toggleProjectorMode() {
  document.body.classList.toggle('projector-mode');
  const btn = document.getElementById('toggle-projector-btn');
  if (document.body.classList.contains('projector-mode')) {
    btn.innerHTML = '<span class="icon">💻</span> Exit Projector View Mode';
  } else {
    btn.innerHTML = '<span class="icon">📺</span> Projector View Mode';
  }
}
