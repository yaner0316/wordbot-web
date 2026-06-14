// ========== State ==========
const {
  adaptDemoContextByLevel,
  buildOptionMeaningsExplanation,
  buildQuestionExplanation,
  normalizeArticleContext,
  optionWord,
} = WordBotQuizLogic;
const {
  buildReviewSummary,
  getResultActions,
} = WordBotReviewFlow;
const DEFAULT_LEVEL = '中学';
const state = {
  user: null,
  level: DEFAULT_LEVEL,
  mode: 'real',
  historyMode: 'real',
  quiz: null,
  currentQuestion: 0,
  answers: [],
  confidences: [],
  users: [],
  submitting: false,
  session: {
    kind: 'quiz',
    sourceTestId: null,
    reviewId: null,
    parentReviewId: null,
    round: 0,
    firstResult: null,
    reviewRounds: [],
    remainingRecordIds: [],
    deferredRecordIds: [],
    analysisViewed: false,
  },
};

const API_BASE = (window.WORDBOT_CONFIG?.API_BASE || '').replace(/\/$/, '');
const DEMO_MODE = new URLSearchParams(window.location.search).get('demo') === '1';

// ========== Demo Mode ==========
const DEMO_WORDS = [
  { word:'opportunity', meaning:'a chance to do something', cn:'机会', context:'This job is a great opportunity for young people to grow.', pos:'n.' },
  { word:'abandon', meaning:'to leave someone or something', cn:'放弃；遗弃', context:'They had to abandon the project due to lack of funds.', pos:'v.' },
  { word:'significant', meaning:'important or meaningful', cn:'重要的；有意义的', context:'There has been a significant increase in sales this year.', pos:'adj.' },
  { word:'benevolent', meaning:'well-meaning and kindly', cn:'仁慈的；乐善好施的', context:'The benevolent donor gave millions to charity.', pos:'adj.' },
  { word:'elaborate', meaning:'detailed and complicated', cn:'精心制作的；详尽的', context:'She gave an elaborate explanation of the entire process.', pos:'adj.' },
  { word:'inevitable', meaning:'certain to happen', cn:'不可避免的', context:'Change is inevitable in any growing organization.', pos:'adj.' },
  { word:'persistent', meaning:'continuing firmly despite difficulties', cn:'坚持不懈的', context:'Her persistent efforts finally paid off.', pos:'adj.' },
  { word:'ambiguous', meaning:'having more than one meaning', cn:'模糊的；模棱两可的', context:'The contract language was deliberately ambiguous.', pos:'adj.' },
  { word:'resilient', meaning:'able to recover quickly', cn:'有弹性的；适应力强的', context:'Children are remarkably resilient in the face of adversity.', pos:'adj.' },
  { word:'fluctuate', meaning:'to change frequently', cn:'波动；变化不定', context:'Stock prices fluctuate throughout the trading day.', pos:'v.' },
  { word:'accumulate', meaning:'to gather or collect', cn:'积累；积聚', context:'Dust tends to accumulate on neglected surfaces.', pos:'v.' },
  { word:'compelling', meaning:'very convincing or interesting', cn:'令人信服的；引人入胜的', context:'The detective found compelling evidence at the scene.', pos:'adj.' },
  { word:'deteriorate', meaning:'to become worse', cn:'恶化；退化', context:'His health began to deteriorate after the accident.', pos:'v.' },
  { word:'feasible', meaning:'possible and practical', cn:'可行的', context:'The engineer confirmed the plan was technically feasible.', pos:'adj.' },
  { word:'genuine', meaning:'real and sincere', cn:'真正的；真诚的', context:'She showed genuine concern for her colleagues.', pos:'adj.' },
];
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; }
  return a;
}

function generateDemoQuiz(level) {
  const selected = shuffle(DEMO_WORDS).slice(0, 6);
  // fill remaining with more words
  const remaining = shuffle(DEMO_WORDS.filter(w => !selected.includes(w)));
  const words = [...selected, ...remaining.slice(0, 4)];
  const types = [1,1,1,1,1,1,2,2,3,3];
  const shuffledTypes = shuffle(types);
  const questions = words.map((w, i) => {
    const type = shuffledTypes[i];
    const distractors = shuffle(DEMO_WORDS.filter(d => d.word !== w.word)).slice(0, 3).map(d => d.word);
    const opts = shuffle([w.word, ...distractors]);
    const correctIdx = opts.indexOf(w.word);
    const letters = ['A','B','C','D'];
    let context = '';
    if (type === 1) {
      const pattern = new RegExp('\\b' + w.word + '\\b', 'gi');
      context = adaptDemoContextByLevel(w, type, level).replace(pattern, '_____');
      context = normalizeArticleContext(context);
    } else if (type === 2) {
      context = adaptDemoContextByLevel(w, type, level);
    } else {
      context = adaptDemoContextByLevel(w, type, level);
    }
    const optionMeanings = opts.map(optionWord => {
      const optionInfo = DEMO_WORDS.find(item => item.word === optionWord);
      return optionInfo?.cn || '中文释义补充失败';
    });
    return { type, word: w.word, context, options: opts.map((o, i) => `${letters[i]}. ${o}`), optionMeanings, answer: letters[correctIdx], _correctIdx: correctIdx };
  });
  return { testId: 'DEMO-' + Date.now().toString(36), questions };
}

function generateDemoStats(user) {
  const total = DEMO_WORDS.length;
  const mastered = Math.floor(total * 0.4);
  const pending = total - mastered;
  const totalTests = 5;
  const correctCount = 32;
  const totalQuestions = 50;
  return {
    totalWords: total, masteredWords: mastered, pendingWords: pending,
    totalTests, totalQuestions, correctCount,
    accuracyRate: ((correctCount/totalQuestions)*100).toFixed(1) + '%',
    lastTestTime: Date.now() - 86400000
  };
}

function generateDemoHistory(user) {
  const history = [];
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    const total = 10;
    const correct = Math.floor(Math.random() * 5) + 4;
    const questions = shuffle(DEMO_WORDS).slice(0, total).map(w => ({
      word: w.word, question: w.cn, type: Math.random() > 0.5 ? 3 : 2,
      options: ['A','B','C','D'], yourAnswer: 'A', correctAnswer: 'A', isCorrect: true
    }));
    history.push({
      testId: 'hist-' + i, time: now - i * 86400000 * 2,
      questions: questions.map((q, j) => ({ ...q, isCorrect: j < correct })),
      correct, total
    });
  }
  return { history };
}

function calculateDemoGameReward(correct, total, mode) {
  if (mode !== 'real') {
    return { eligible: false, minutes: 0, tier: 'none', reason: 'test_mode' };
  }
  if (correct >= total && total > 0) {
    return { eligible: true, minutes: 10, tier: 'perfect', reason: 'perfect_score' };
  }
  if (correct >= 9) {
    return { eligible: true, minutes: 5, tier: 'excellent', reason: 'excellent_score' };
  }
  return { eligible: false, minutes: 0, tier: 'none', reason: 'score_below_threshold' };
}

// ========== Helpers ==========
function $(id) { return document.getElementById(id); }

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showLoading(text) {
  $('loadingText').textContent = text || '加载中...';
  $('loadingOverlay').classList.add('active');
}
function hideLoading() { $('loadingOverlay').classList.remove('active'); }

function showToast(msg, type) {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast ' + type + ' show';
  clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

function formatDate(ts) {
  if (!ts) return '暂无';
  const d = new Date(Number(ts));
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function api(path, opts) {
  const response = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    const error = new Error(data.error || `请求失败（HTTP ${response.status}）`);
    error.code = data.code || 'HTTP_ERROR';
    throw error;
  }
  return data;
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $('page' + page.charAt(0).toUpperCase() + page.slice(1)).classList.add('active');
  if (page === 'home') loadHome();
  if (page === 'history') loadHistory();
}

// ========== User ==========
function renderUsers(users) {
  const el = $('userList');
  el.replaceChildren();
  if (!users.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text-secondary);font-size:14px;';
    empty.textContent = '暂无用户';
    el.appendChild(empty);
    return;
  }
  users.forEach(user => {
    const button = document.createElement('button');
    button.className = `user-btn${state.user === user ? ' active' : ''}`;
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = user.charAt(0).toUpperCase();
    button.append(avatar, document.createTextNode(user));
    button.addEventListener('click', () => selectUser(user));
    el.appendChild(button);
  });
}

function selectUser(user) {
  state.user = user;
  state.level = loadUserDifficulty(user);
  updateLevelButtons();
  renderUsers(state.users);
  loadStats(user);
  restoreActiveReview(user);
}

function difficultyPreferenceKey(user) {
  return `wordbot:difficulty:${user}`;
}

function loadUserDifficulty(user) {
  return localStorage.getItem(difficultyPreferenceKey(user)) || DEFAULT_LEVEL;
}

function activeReviewKey(user) {
  return `wordbot:active-review:${user}`;
}

function saveActiveReview() {
  if (!state.user || state.session.kind !== 'review') return;
  localStorage.setItem(activeReviewKey(state.user), JSON.stringify({
    session: state.session,
    quiz: state.quiz,
    currentQuestion: state.currentQuestion,
    answers: state.answers,
    confidences: state.confidences,
  }));
}

function clearActiveReview() {
  if (state.user) localStorage.removeItem(activeReviewKey(state.user));
}

function restoreActiveReview(user) {
  const raw = localStorage.getItem(activeReviewKey(user));
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    if (!saved?.session || !saved?.quiz?.questions?.length) return false;
    state.session = saved.session;
    state.quiz = saved.quiz;
    state.currentQuestion = saved.currentQuestion || 0;
    state.answers = saved.answers || new Array(saved.quiz.questions.length).fill(null);
    state.confidences = saved.confidences || new Array(saved.quiz.questions.length).fill(null);
    if (saved.quiz.result) {
      navigateTo('results');
      renderResults(saved.quiz.result);
    } else {
      navigateTo('quiz');
      renderQuestion(state.currentQuestion);
    }
    return true;
  } catch {
    localStorage.removeItem(activeReviewKey(user));
    return false;
  }
}

function updateLevelButtons() {
  document.querySelectorAll('.level-btn[data-level]').forEach(button => {
    button.classList.toggle('level-active', button.dataset.level === state.level);
  });
}

// ========== Home ==========
async function loadHome() {
  showLoading('加载用户数据...');
  try {
    if (DEMO_MODE) {
      state.users = ['demo'];
      renderUsers(state.users);
      selectUser('demo');
      showToast('当前为演示模式，数据不会写入服务器', 'info');
      hideLoading();
      return;
    }
    const data = await api('/api/admin/users');
    state.users = data.users || [];
    renderUsers(state.users);
    if (state.user && state.users.includes(state.user)) {
      renderUsers(state.users);
      await loadStats(state.user);
    } else if (state.users.length > 0) {
      selectUser(state.users[0]);
    } else {
      // 无用户时显示手动输入
      $('statsContent').innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text-secondary);font-size:15px;">💡 API未返回用户，请输入用户名预览</div>';
      $('userInputWrap').style.display = 'block';
    }
  } catch(e) {
    showToast('加载用户失败: ' + e.message, 'error');
    $('statsContent').innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text-secondary);font-size:15px;">💡 后端连接异常，请输入用户名预览</div>';
    $('userInputWrap').style.display = 'block';
  }
  hideLoading();
}

// 清理测试数据确认
function showCleanupConfirm() {
  const user = state.user;
  if (!user) { showToast('请先选择用户', 'warn'); return; }
  if (!confirm(`确定删除用户 "${user}" 的全部“测试模式”答题记录吗？\n\n正式学习记录不会被删除。`)) return;
  cleanupUserData(user);
}

async function cleanupUserData(user) {
  if (DEMO_MODE) {
    showToast('演示模式没有可清理的服务器记录', 'info');
    return;
  }
  showLoading('正在清理测试数据...');
  try {
    const res = await api('/api/admin/cleanup', {
      method: 'POST',
      body: JSON.stringify({ user })
    });
    if (res.success) {
      showToast(`已删除 ${res.deleted} 条测试记录`, 'success');
      // 刷新统计
      loadStats(user);
    } else {
      showToast(res.error || '清理失败', 'error');
    }
  } catch(e) {
    showToast('清理失败: ' + e.message, 'error');
  }
  hideLoading();
}

function selectLevel(el, level) {
  state.level = level;
  if (state.user) localStorage.setItem(difficultyPreferenceKey(state.user), level);
  updateLevelButtons();
}

function selectMode(el, mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach(button => {
    button.classList.toggle('level-active', button.dataset.mode === mode);
  });
  $('modeHint').textContent = mode === 'test'
    ? '测试模式只保存答题记录，不改变掌握状态和正式统计'
    : '正式学习会更新掌握状态和统计';
}

function selectHistoryMode(el, mode) {
  state.historyMode = mode;
  document.querySelectorAll('.history-mode-btn').forEach(button => {
    button.classList.toggle('level-active', button.dataset.mode === mode);
  });
  loadHistory();
}

function manualSelectUser() {
  const name = $('userInput').value.trim();
  if (!name) { showToast('请输入用户名', 'warn'); return; }
  state.users = [name];
  $('userInputWrap').style.display = 'none';
  renderUsers([name]);
  selectUser(name);
}

async function loadStats(user) {
  if (!user) return;
  showLoading('加载统计...');
  try {
    const data = DEMO_MODE
      ? generateDemoStats(user)
      : await api('/api/stats/' + encodeURIComponent(user));
    const { totalWords=0, masteredWords=0, pendingWords=0, totalTests=0, totalQuestions=0, correctCount=0, accuracyRate='0%', lastTestTime } = data;
    const pct = totalWords > 0 ? Math.round(masteredWords/totalWords*100) : 0;
    const dash = 282.7 * pct / 100;

    $('statsContent').innerHTML = `
      <div class="progress-ring-wrap">
        <div class="progress-ring">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle class="bg" cx="50" cy="50" r="45"/>
            <circle class="fg" cx="50" cy="50" r="45" style="stroke-dasharray:282.7;stroke-dashoffset:${282.7-dash};"/>
          </svg>
          <div class="center">
            <div class="pct">${pct}%</div>
            <div class="pct-label">已掌握</div>
          </div>
        </div>
        <div class="ring-stats">
          <div class="ring-stat-item"><span><span class="dot" style="background:var(--orange);"></span>已掌握</span><strong>${masteredWords}</strong></div>
          <div class="ring-stat-item"><span><span class="dot" style="background:var(--text-muted);"></span>待复习</span><strong>${pendingWords}</strong></div>
          <div class="ring-stat-item"><span><span class="dot" style="background:var(--blue);"></span>总词汇</span><strong>${totalWords}</strong></div>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card orange">
          <div class="label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>考核次数</div>
          <div class="value">${totalTests}</div>
        </div>
        <div class="stat-card green">
          <div class="label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>正确率</div>
          <div class="value">${accuracyRate}</div>
          <div class="sub">${correctCount}/${totalQuestions}</div>
        </div>
      </div>
      ${lastTestTime ? `<div style="margin-top:12px;text-align:center;font-size:13px;color:var(--text-secondary);">🕐 上次考核：${formatDate(lastTestTime)}</div>` : ''}
      <div style="margin-top:14px;text-align:center;">
        <button class="btn btn-outline btn-small" onclick="showCleanupConfirm()" style="color:var(--red);border-color:var(--red);font-size:12px;">
          🗑 清理测试模式记录（${escapeHtml(user)}）
        </button>
      </div>
    `;
  } catch(e) {
    showToast('加载统计失败: ' + e.message, 'error');
  }
  hideLoading();
}

// ========== Quiz ==========
async function startQuiz() {
  if (!state.user) { showToast('请先选择一个用户', 'error'); return; }
  showLoading('正在生成题目...');
  clearActiveReview();
  state.session = {
    kind: 'quiz',
    sourceTestId: null,
    reviewId: null,
    parentReviewId: null,
    round: 0,
    firstResult: null,
    reviewRounds: [],
    remainingRecordIds: [],
    deferredRecordIds: [],
    analysisViewed: false,
  };
  try {
    if (DEMO_MODE) {
      const demo = generateDemoQuiz(state.level);
      demo.mode = state.mode;
      demo.level = state.level;
      state.quiz = demo;
      state.currentQuestion = 0;
      state.answers = new Array(demo.questions.length).fill(null);
      state.confidences = new Array(demo.questions.length).fill(null);
      navigateTo('quiz');
      renderQuestion(0);
      return;
    }
    const data = await api('/api/quiz', {
      method: 'POST',
      body: JSON.stringify({ user: state.user, level: state.level, mode: state.mode })
    });
    if (data.warning) showToast(data.warning, 'info');
    state.quiz = data;
    state.currentQuestion = 0;
    state.answers = new Array(data.questions.length).fill(null);
    state.confidences = new Array(data.questions.length).fill(null);
    navigateTo('quiz');
    renderQuestion(0);
  } catch(e) {
    showToast('生成题目失败: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderQuestion(idx) {
  const q = state.quiz.questions[idx];
  const total = state.quiz.questions.length;
  $('quizProgressFill').style.width = ((idx+1)/total*100) + '%';
  $('quizProgressText').textContent = idx + 1;
  $('quizTotalText').textContent = total;

  const types = {1:'语境填空', 2:'英英释义', 3:'中英释义'};
  const typeClasses = {1:'type1', 2:'type2', 3:'type3'};
  const typeIcons = {1:'📖', 2:'📝', 3:'🌏'};

  let questionDisplay = escapeHtml(q.context || '');
  // For type 1, show the blank
  if (q.type === 1) {
    questionDisplay = questionDisplay.replace(/_____/g, '<span class="blank">&nbsp;</span>');
  }

  const optsHtml = q.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    const selected = state.answers[idx] === i ? 'selected' : '';
    return `<button class="option-btn ${selected}" onclick="selectOption(${idx}, ${i})">
      <span class="letter">${letter}</span>
      <span>${escapeHtml(opt.replace(/^[A-D]\.\s*/, ''))}</span>
    </button>`;
  }).join('');
  const confidence = state.confidences[idx];
  const confidenceHtml = state.answers[idx] === null ? '' : `
    <div class="confidence-panel">
      <div class="confidence-label">这道题你是确定认识，还是猜的？</div>
      <div class="confidence-actions">
        <button class="confidence-btn ${confidence === 'sure' ? 'selected' : ''}" onclick="selectConfidence(${idx}, 'sure')">确定认识</button>
        <button class="confidence-btn ${confidence === 'guess' ? 'selected' : ''}" onclick="selectConfidence(${idx}, 'guess')">猜的/不确定</button>
      </div>
      <div class="confidence-hint">猜对仍计入本次得分，但不作为“已掌握”的证据。</div>
    </div>`;

  $('questionArea').innerHTML = `
    <div class="question-card">
      <div class="question-type-badge ${typeClasses[q.type]}">${typeIcons[q.type]} ${types[q.type]}</div>
      <div class="question-text">${questionDisplay}</div>
      <div class="options">${optsHtml}</div>
      ${confidenceHtml}
    </div>
  `;

  const isLastQuestion = idx === total - 1;
  const canContinue = state.answers[idx] !== null &&
    state.confidences[idx] !== null;
  $('prevBtn').style.visibility = idx === 0 ? 'hidden' : 'visible';
  $('nextBtn').style.display = isLastQuestion ? 'none' : 'flex';
  $('submitBtn').style.display = isLastQuestion ? 'flex' : 'none';
  $('nextBtn').disabled = !canContinue;
  $('submitBtn').disabled = !canContinue;
}

function selectOption(qIdx, optIdx) {
  state.answers[qIdx] = optIdx;
  saveActiveReview();
  renderQuestion(state.currentQuestion);
}

function selectConfidence(qIdx, confidence) {
  state.confidences[qIdx] = confidence;
  saveActiveReview();
  renderQuestion(state.currentQuestion);
}

function prevQuestion() {
  if (state.currentQuestion > 0) {
    state.currentQuestion--;
    renderQuestion(state.currentQuestion);
  }
}

function canLeaveCurrentQuestion() {
  const index = state.currentQuestion;
  if (state.answers[index] === null) {
    showToast('请先选择一个答案', 'info');
    return false;
  }
  if (state.confidences[index] === null) {
    showToast('请选择“确定认识”或“猜的/不确定”', 'info');
    return false;
  }
  return true;
}

function nextQuestion() {
  if (!canLeaveCurrentQuestion()) return;
  if (state.currentQuestion < state.quiz.questions.length - 1) {
    state.currentQuestion++;
    renderQuestion(state.currentQuestion);
  }
}

async function submitQuiz() {
  if (!state.quiz) return;
  if (state.submitting) return;
  if (!canLeaveCurrentQuestion()) return;
  const unanswered = state.answers.indexOf(null);
  if (unanswered !== -1) {
    showToast(`还有第 ${unanswered+1} 题未作答`, 'info');
    state.currentQuestion = unanswered;
    renderQuestion(unanswered);
    return;
  }
  const unconfirmed = state.confidences.indexOf(null);
  if (unconfirmed !== -1) {
    showToast(`请确认第 ${unconfirmed+1} 题是“确定认识”还是“猜的/不确定”`, 'info');
    state.currentQuestion = unconfirmed;
    renderQuestion(unconfirmed);
    return;
  }

  state.submitting = true;
  $('submitBtn').disabled = true;
  showLoading('正在提交...');
  try {
    let data;
    if (DEMO_MODE) {
      const questions = state.quiz.questions || [];
      const letters = ['A','B','C','D'];
      let correct = 0;
      const results = questions.map((q, i) => {
        const yourIdx = state.answers[i];
        const yourLetter = yourIdx !== null && yourIdx !== undefined ? letters[yourIdx] : null;
        const isCorrect = yourLetter === q.answer;
        if (isCorrect) correct++;
        return {
          q: i+1,
          word: q.word,
          recordId: q.recordId || q.word,
          your: yourLetter,
          answer: q.answer,
          correct: isCorrect,
          confidence: state.confidences[i]
        };
      });
      const total = results.length;
      data = {
        mode: state.mode,
        results,
        correct,
        total,
        accuracy: `${((correct/total)*100).toFixed(1)}%`,
        masteredWords: [],
        gameReward: calculateDemoGameReward(correct, total, state.mode),
        stats: { total: 42, mastered: 18, pending: 24 }
      };
    } else if (state.session.kind === 'review') {
      data = await api(`/api/reviews/${encodeURIComponent(state.session.reviewId)}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          user: state.user,
          answers: state.answers.map((option, i) => ({
            option,
            confidence: state.confidences[i]
          }))
        })
      });
    } else {
      data = await api('/api/submit', {
        method: 'POST',
        body: JSON.stringify({
          user: state.user,
          testId: state.quiz.testId,
          answers: state.answers.map((option, i) => ({
            option,
            confidence: state.confidences[i]
          }))
        })
      });
    }
    state.quiz.result = data;
    const remaining = (data.results || [])
      .filter(result => !result.correct)
      .map(result => result.recordId || result.word)
      .filter(Boolean);
    state.session.remainingRecordIds = data.remainingRecordIds || remaining;
    if (state.session.kind === 'quiz') {
      state.session.sourceTestId = state.quiz.testId;
      state.session.firstResult = data;
      state.session.analysisViewed = false;
    } else {
      state.session.reviewRounds.push(data);
      state.session.analysisViewed = true;
      saveActiveReview();
    }
    navigateTo('results');
    renderResults(data);
  } catch(e) {
    showToast('提交失败: ' + e.message, 'error');
  } finally {
    state.submitting = false;
    $('submitBtn').disabled = false;
    hideLoading();
  }
}

// ========== Results ==========
const ENCOURAGE = {
  perfect: ['满分！你就是单词大师！🏆', '全部答对，太厉害了！👑', '完美通关，学霸本霸！⭐'],
  great: ['表现很棒，继续加油！💪', '掌握得不错，再接再厉！🔥', '优秀！离满分不远了！✨'],
  good: ['还不错，继续努力！📚', '及格了，下次会更好！💪', '稳住，再复习一下就能全对！'],
  poor: ['还需要多复习哦！📖', '别灰心，多练几次就好了！💪', '加油！每一次都是进步！🌟'],
};
function getEncourage(correct, total) {
  const r = correct / total;
  if (r >= 1) return ENCOURAGE.perfect[Math.floor(Math.random() * ENCOURAGE.perfect.length)];
  if (r >= 0.8) return ENCOURAGE.great[Math.floor(Math.random() * ENCOURAGE.great.length)];
  if (r >= 0.6) return ENCOURAGE.good[Math.floor(Math.random() * ENCOURAGE.good.length)];
  return ENCOURAGE.poor[Math.floor(Math.random() * ENCOURAGE.poor.length)];
}

let _showAnalysis = false;

function renderResults(data) {
  const { correct, total, accuracy, masteredWords } = data;
  const pass = correct / total >= 0.6;
  const pct = Math.round(correct/total*100);
  const encourage = getEncourage(correct, total);
  _showAnalysis = state.session.kind === 'review';
  state.session.analysisViewed = _showAnalysis;
  const reward = data.gameReward;
  const rewardHtml = reward?.eligible && state.session.kind === 'quiz'
    ? `<div class="game-reward-card">
        <div class="game-reward-icon">🎮</div>
        <div>
          <div class="game-reward-title">获得小游戏时间 ${escapeHtml(reward.minutes)} 分钟</div>
          <div class="game-reward-sub">${reward.tier === 'perfect' ? '10 题全对奖励' : '答对 9 题以上奖励'}，猜对也计入本次得分。</div>
        </div>
      </div>`
    : '';

  let detailsHtml = '';
  if (data.results) {
    data.results.forEach((r, i) => {
      const q = state.quiz?.questions[i];
      const typeNames = {1:'语境填空', 2:'英英释义', 3:'中英释义'};

      // 构建完整题干展示
      let contextDisplay = '';
      let explanationHtml = '';

      if (q?.type === 1 && q?.context) {
        // Type 1: 显示上下文（空白处用 ___ 占位）
        contextDisplay = escapeHtml(q.context).replace(/_____/g, '<span class="inline-blank">&nbsp;</span>');
      } else if (q?.type === 2 && q?.context) {
        contextDisplay = `📖 ${escapeHtml(q.context)}`;
      } else if (q?.type === 3 && q?.context) {
        contextDisplay = `🌏 ${escapeHtml(q.context)}`;
      }
      explanationHtml = buildOptionMeaningsExplanation(q, escapeHtml)
        + buildQuestionExplanation(q, r, escapeHtml);

      // 构建选项列表
      let optionsHtml = '';
      if (q?.options && q.options.length > 0) {
        optionsHtml = q.options.map(opt => {
          const letter = opt[0];
          const isCorrect = letter === q.answer;
          const isUserChoice = letter === r.your;
          let cls = 'opt-item';
          if (isCorrect) cls += ' opt-correct';
          if (isUserChoice && !r.correct) cls += ' opt-wrong';
          let tag = '';
          if (isCorrect && isUserChoice) tag = '<span class="opt-tag tag-correct">✔ 正确答案</span>';
          else if (isCorrect) tag = '<span class="opt-tag tag-correct">✔ 正确答案</span>';
          else if (isUserChoice) tag = '<span class="opt-tag tag-wrong">✘ 你的选择</span>';
          return `<div class="${cls}">${escapeHtml(opt)} ${tag}</div>`;
        }).join('');
      } else {
        optionsHtml = `<div style="color:#999;font-size:13px;padding:8px 0;">选项未保存（历史记录）</div>`;
      }

      detailsHtml += `
        <div class="result-analysis-card ${r.correct ? 'correct' : 'wrong'}">
          <div class="row">
            <span class="word">${escapeHtml(r.word)}</span>
            <span class="status-badge ${r.correct ? 'correct' : 'wrong'}">${r.correct ? '✓ 正确' : '✗ 错误'}</span>
          </div>
          <div class="row" style="font-size:13px;color:var(--text-secondary);margin-top:4px;">
            <span>${typeNames[q?.type] || ''} · 第 ${i+1} 题</span>
            <span>${r.confidence === 'guess' ? '猜的/不确定：本题不计掌握证据' : '确定认识'}</span>
          </div>

          <div class="ctx-box">
            <div class="ctx-label">📝 题干：</div>
            <div class="ctx-text">${contextDisplay}</div>
          </div>

          <div class="opts-box">
            <div class="opts-label">选项：</div>
            ${optionsHtml}
          </div>

          <div class="explain-box">
            <div class="explain-label">解析：</div>
            ${explanationHtml}
          </div>
        </div>
      `;
    });
  }

  $('resultContent').innerHTML = `
    <div class="result-hero">
      <div class="big-score ${pass ? 'pass' : 'fail'}"><strong>${correct}</strong><span style="font-size:28px;color:var(--text-secondary);font-weight:400;">/${total}</span></div>
      <div style="font-size:16px;color:var(--text-secondary);margin-top:4px;">正确率 ${escapeHtml(accuracy)}</div>
      <div style="font-size:18px;font-weight:600;margin-top:12px;color:${pass ? 'var(--orange)' : 'var(--text-secondary)'};">${encourage}</div>
      ${data.mode === 'test' ? '<div class="mastered-tag" style="background:#FFF3E0;color:#E65100;margin-top:8px;">测试模式：不计入正式统计</div>' : ''}
      ${masteredWords && masteredWords.length ? `<div class="mastered-tag" style="background:#E8F5E9;color:var(--green);margin-top:8px;">✅ 新掌握 ${masteredWords.length} 个单词</div>` : ''}
      ${rewardHtml}
    </div>

    <div id="analysisArea" style="display:${_showAnalysis ? 'block' : 'none'};margin-bottom:20px;">
      <div class="section-title">📋 逐题回顾</div>
      ${detailsHtml}
    </div>

    <div id="resultActionPanel" class="review-action-panel"></div>

    <div style="text-align:right;margin-top:16px;">
      <button class="btn btn-outline btn-small" id="analysisBtn" onclick="toggleAnalysis()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        答案分析
      </button>
    </div>
  `;
  updateResultActions();

  // Confetti if passed
  if (pass) {
    launchConfetti();
  }
}

function toggleAnalysis() {
  _showAnalysis = !_showAnalysis;
  const area = $('analysisArea');
  const btn = $('analysisBtn');
  area.style.display = _showAnalysis ? 'block' : 'none';
  state.session.analysisViewed = _showAnalysis;
  if (btn) {
    btn.innerHTML = _showAnalysis
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> 收起分析'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg> 答案分析';
  }
  updateResultActions();
}

function updateResultActions() {
  const panel = $('resultActionPanel');
  if (!panel) return;
  const actions = getResultActions({
    sessionKind: state.session.kind,
    analysisViewed: state.session.analysisViewed,
    remainingRecordIds: state.session.remainingRecordIds,
  });
  if (actions.primary === 'show-analysis') {
    panel.innerHTML = '<button class="btn btn-primary" onclick="toggleAnalysis()">查看答案解析</button>';
  } else if (actions.primary === 'start-review') {
    panel.innerHTML = `<button class="btn btn-primary" onclick="startWrongAnswerReview()">开始错题复习（${state.session.remainingRecordIds.length} 个词）</button>`;
  } else if (actions.primary === 'continue-review') {
    panel.innerHTML = `
      <button class="btn btn-primary" onclick="continueWrongAnswerReview()">继续复习</button>
      <button class="btn btn-secondary" onclick="deferWrongAnswerReview()">下次复习</button>`;
  } else {
    panel.innerHTML = '<button class="btn btn-primary" onclick="showFinalReviewSummary()">完成测验</button>';
  }
}

function generateDemoReviewQuiz() {
  const wrongWords = new Set(state.session.remainingRecordIds);
  const sourceQuestions = state.quiz.questions.filter(question =>
    wrongWords.has(question.word) || wrongWords.has(question.recordId)
  );
  const questions = sourceQuestions.map(source => {
    const info = DEMO_WORDS.find(word => word.word === source.word);
    const type = source.type === 1 ? 2 : 1;
    const oldOptions = new Set(source.options.map(option =>
      option.replace(/^[A-D]\.\s*/, '')
    ));
    const distractors = shuffle(DEMO_WORDS.filter(word =>
      word.word !== source.word && !oldOptions.has(word.word)
    )).slice(0, 3);
    const options = shuffle([info, ...distractors]);
    const letters = ['A', 'B', 'C', 'D'];
    const answer = letters[options.findIndex(option => option.word === source.word)];
    let context = type === 1
      ? `A careful learner can _____ this word in a fresh sentence.`
      : info.meaning;
    return {
      type,
      word: source.word,
      recordId: source.recordId || source.word,
      context,
      options: options.map((option, index) => `${letters[index]}. ${option.word}`),
      optionMeanings: options.map(option => option.cn),
      answer,
      correctMeaning: info.cn,
    };
  });
  return {
    reviewId: `demo-review-${Date.now()}`,
    sourceTestId: state.session.sourceTestId,
    parentReviewId: state.session.reviewId || '',
    round: state.session.round + 1,
    mode: state.mode,
    questions,
  };
}

async function startWrongAnswerReview(parentReviewId = '') {
  showLoading('正在生成错题复习...');
  try {
    const data = DEMO_MODE
      ? generateDemoReviewQuiz()
      : await api('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({
            user: state.user,
            sourceTestId: state.session.sourceTestId,
            parentReviewId,
          })
        });
    state.session.kind = 'review';
    state.session.reviewId = data.reviewId;
    state.session.parentReviewId = data.parentReviewId || '';
    state.session.round = data.round || state.session.round + 1;
    state.session.analysisViewed = false;
    state.quiz = {
      testId: data.reviewId,
      mode: data.mode,
      questions: data.questions,
    };
    state.currentQuestion = 0;
    state.answers = new Array(data.questions.length).fill(null);
    state.confidences = new Array(data.questions.length).fill(null);
    saveActiveReview();
    navigateTo('quiz');
    renderQuestion(0);
  } catch (error) {
    showToast('生成错题复习失败: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

function continueWrongAnswerReview() {
  return startWrongAnswerReview(state.session.reviewId);
}

async function deferWrongAnswerReview() {
  showLoading('正在保存下次复习...');
  try {
    if (!DEMO_MODE) {
      await api(`/api/reviews/${encodeURIComponent(state.session.reviewId)}/defer`, {
        method: 'POST',
        body: JSON.stringify({ user: state.user })
      });
    }
    state.session.deferredRecordIds = [...state.session.remainingRecordIds];
    clearActiveReview();
    showFinalReviewSummary();
  } catch (error) {
    showToast('保存下次复习失败: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

function showFinalReviewSummary() {
  clearActiveReview();
  const summary = buildReviewSummary({
    firstResult: state.session.firstResult,
    reviewRounds: state.session.reviewRounds,
    deferredRecordIds: state.session.deferredRecordIds,
  });
  $('resultContent').innerHTML = `
    <div class="result-hero">
      <div class="section-title">学习完成</div>
      <div class="review-summary-grid">
        <div><strong>${summary.firstCorrect}/${summary.firstTotal}</strong><span>首次成绩</span></div>
        <div><strong>${summary.reviewed}</strong><span>复习词数</span></div>
        <div><strong>${summary.corrected}</strong><span>复习后答对</span></div>
        <div><strong>${summary.deferredRecordIds.length}</strong><span>下次优先复习</span></div>
      </div>
    </div>
    <div class="actions">
      <button class="btn btn-primary" onclick="navigateTo('home')">返回首页</button>
      <button class="btn btn-secondary" onclick="navigateTo('history')">查看历史</button>
    </div>`;
}

function launchConfetti() {
  const container = $('confettiContainer');
  container.innerHTML = '';
  const colors = ['#FF6B00','#FF8C38','#FFB347','#34C759','#007AFF','#AF52DE','#FF3B30'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = Math.random() * 100 + '%';
    el.style.top = Math.random() * 50 + 30 + '%';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.width = (6 + Math.random() * 8) + 'px';
    el.style.height = (6 + Math.random() * 8) + 'px';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    el.style.animationDelay = (Math.random() * 0.8) + 's';
    el.style.animationDuration = (1 + Math.random() * 0.5) + 's';
    container.appendChild(el);
  }
  setTimeout(() => container.innerHTML = '', 2500);
}

// ========== History ==========
function renderHistoryList(list) {
  const content = $('historyContent');
  content.replaceChildren();
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    const message = document.createElement('p');
    message.textContent = state.historyMode === 'test'
      ? '还没有测试模式记录'
      : '还没有正式考核记录';
    empty.appendChild(message);
    content.appendChild(empty);
    return;
  }

  const container = document.createElement('div');
  container.className = 'history-list';
  list.forEach(item => {
    const pass = item.correct / item.total >= 0.6;
    const pct = item.total > 0 ? Math.round(item.correct / item.total * 100) : 0;
    const card = document.createElement('div');
    card.className = 'history-item';
    card.addEventListener('click', () => {
      alert(`考核: ${item.testId}\n日期: ${formatDate(item.time)}\n得分: ${item.correct}/${item.total} (${pct}%)`);
    });

    const top = document.createElement('div');
    top.className = 'top';
    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = formatDate(item.time);
    const score = document.createElement('span');
    score.className = `score ${pass ? 'pass' : 'fail'}`;
    score.textContent = `${item.correct}/${item.total}`;
    top.append(date, score);

    const bottom = document.createElement('div');
    bottom.className = 'bottom';
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('div');
    fill.className = `fill ${pass ? 'pass' : 'fail'}`;
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    const accuracy = document.createElement('span');
    accuracy.className = 'accuracy';
    accuracy.textContent = `${pct}%`;
    bottom.append(bar, accuracy);

    card.append(top, bottom);
    container.appendChild(card);
  });
  content.appendChild(container);
}

async function loadHistory() {
  if (!state.user) { showToast('请先选择用户', 'error'); return; }
  showLoading('加载历史记录...');
  try {
    const data = DEMO_MODE
      ? generateDemoHistory(state.user)
      : await api(
          '/api/history/' + encodeURIComponent(state.user) +
          '?mode=' + encodeURIComponent(state.historyMode)
        );
    renderHistoryList(data.history || []);
  } catch(e) {
    showToast('加载历史失败: ' + e.message, 'error');
  }
  hideLoading();
}

// ========== Init ==========
loadHome();
