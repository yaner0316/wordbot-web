'use strict';
const challengePicker = { user: null, candidates: [], selected: new Set(), filter: 'all', loading: false, busy: false, token: 0, timer: null, pendingIds: null };
const challengeStatusLabels = { pending: '未开始', recognized: '已认识', consolidating: '巩固中' };

function filterChallengeWords(words, search = '', status = 'all') {
  const query = search.trim().toLocaleLowerCase();
  return words.filter(w => (status === 'all' || w.status === status)
    && (!query || `${w.word} ${w.meaning}`.toLocaleLowerCase().includes(query)));
}
function challengeSelectionSummary(words, selected) {
  const available = words.filter(w => w.eligible);
  const count = available.filter(w => selected.has(w.meaningId)).length;
  const total = Math.min(10, words.length);
  return { total, selected: count, automatic: Math.max(0, total - count), available: available.length };
}
function cancelChallengePreparation() {
  challengePicker.token++;
  clearTimeout(challengePicker.timer);
  challengePicker.timer = null;
  challengePicker.busy = false;
  challengePicker.pendingIds = null;
}
function challengeStatus(message) {
  const el = $('challengeStatus');
  if (el) el.textContent = message;
}
async function openCustomChallenge() {
  if (!state.user) { showToast('请先登录', 'info'); return; }
  cancelChallengePreparation();
  if (challengePicker.user !== state.user) {
    challengePicker.user = state.user;
    challengePicker.selected = new Set();
    challengePicker.candidates = [];
  }
  await navigateTo('challenge');
  await refreshChallengeCandidates();
}
async function refreshChallengeCandidates() {
  const user = state.user;
  const token = challengePicker.token;
  challengePicker.loading = true;
  renderChallengePicker();
  challengeStatus('正在读取你的词库…');
  try {
    let data;
    if (DEMO_MODE) {
      challengePicker.demoQuiz = generateDemoQuiz(state.level);
      data = { candidates: challengePicker.demoQuiz.questions.map((q, i) => ({meaningId:q.meaningId || `demo-${i}`, word:q.word, meaning:q.correctMeaning || '演示词义', status:'pending', eligible:true})) };
    } else data = await api(`/api/quiz/candidates?user=${encodeURIComponent(user)}`);
    if (state.user !== user || token !== challengePicker.token) return;
    challengePicker.candidates = data.candidates || [];
    const eligible = new Set(challengePicker.candidates.filter(w => w.eligible).map(w => w.meaningId));
    challengePicker.selected = new Set([...challengePicker.selected].filter(id => eligible.has(id)));
    challengeStatus('');
  } catch (error) {
    if (state.user === user && token === challengePicker.token) challengeStatus('词库暂时没能加载，请点「刷新词库」再试。');
  } finally {
    if (token === challengePicker.token) { challengePicker.loading = false; renderChallengePicker(); }
  }
}
function setChallengeFilter(filter) {
  challengePicker.filter = filter;
  renderChallengePicker();
}
function toggleChallengeWord(id) {
  if (challengePicker.busy || challengePicker.loading) return;
  const word = challengePicker.candidates.find(w => w.meaningId === id);
  if (!word?.eligible) return;
  challengePicker.pendingIds = null;
  if (challengePicker.selected.has(id)) challengePicker.selected.delete(id);
  else if (challengePicker.selected.size < 10) challengePicker.selected.add(id);
  else { showToast('已经选好 10 个啦，取消一个就能换词。', 'info'); return; }
  renderChallengePicker();
  $('challengeWordList')?.querySelectorAll('[data-meaning-id]').forEach(button => { if (button.dataset.meaningId === id) button.focus(); });
}
function renderChallengePicker() {
  const list = $('challengeWordList');
  if (!list) return;
  const summary = challengeSelectionSummary(challengePicker.candidates, challengePicker.selected);
  const words = filterChallengeWords(challengePicker.candidates, $('challengeSearch')?.value || '', challengePicker.filter);
  $('challengeSelectionCount').textContent = `已选 ${summary.selected} / ${summary.total}`;
  $('challengeAutoCount').textContent = summary.total ? `系统补齐 ${summary.automatic} 个` : '暂时没有可挑战的单词';
  $('challengePoolCount').textContent = `${summary.available} 个词义可挑战`;
  $('challengeShortNote').textContent = summary.available < summary.total
    ? `本次需要 ${summary.total} 个词义，目前 ${summary.available} 个已满 18 小时，请等冷却结束后开考。`
    : summary.total > 0 && summary.total < 10
      ? `词库只有 ${summary.total} 个待考词义，这次考 ${summary.total} 题，不增减游戏时长。` : '每次最多 10 个词义，没选满也没关系。';
  const start = $('challengeStart');
  start.disabled = challengePicker.busy || challengePicker.loading || !summary.total || summary.available < summary.total;
  start.textContent = challengePicker.busy ? '正在准备题目…' : `就考这些，开始挑战！`;
  $('challengeCancel').hidden = !challengePicker.busy;
  $('challengeRefresh').disabled = challengePicker.busy || challengePicker.loading;
  document.querySelectorAll('[data-challenge-filter]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.challengeFilter === challengePicker.filter));
  });
  if (challengePicker.loading && !words.length) { list.innerHTML = '<div class="challenge-empty">正在打开你的词库…</div>'; return; }
  list.innerHTML = words.map(word => {
    const checked = challengePicker.selected.has(word.meaningId);
    const minutes = Math.max(1, Math.ceil((Date.parse(word.cooldownEndsAt) - Date.now()) / 60000));
    const cooling = !word.eligible ? (word.cooldownEndsAt ? `再等 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : '暂不可选，请刷新词库') : '';
    return `<button type="button" class="challenge-word ${checked ? 'is-selected' : ''}" data-meaning-id="${escapeHtml(word.meaningId)}" aria-pressed="${checked}" ${!word.eligible || challengePicker.busy ? 'disabled' : ''}>
      <span class="challenge-check" aria-hidden="true">${checked ? '✓' : ''}</span>
      <span class="challenge-word-content"><strong>${escapeHtml(word.word)}</strong><span>${escapeHtml(word.meaning)}</span></span>
      <span class="challenge-word-meta"><span class="challenge-tag ${escapeHtml(word.status)}">${challengeStatusLabels[word.status] || '未开始'}</span>${cooling ? `<small>${cooling}</small>` : ''}</span>
    </button>`;
  }).join('') || '<div class="challenge-empty">没有找到匹配的词义<br><small>试试英文、中文释义，或换一个筛选。</small></div>';
  list.querySelectorAll('[data-meaning-id]').forEach(button => { button.onclick = () => toggleChallengeWord(button.dataset.meaningId); });
}
async function startRandomChallenge() {
  if (DEMO_MODE) return startQuiz();
  await openCustomChallenge();
  const summary = challengeSelectionSummary(challengePicker.candidates, new Set());
  if (state.currentPage === 'challenge' && !challengePicker.loading && summary.total && summary.available >= summary.total) {
    challengePicker.selected.clear();
    await beginSelectedChallenge('random');
  }
}
async function beginSelectedChallenge(mode = 'custom') {
  if (challengePicker.busy) return;
  challengePicker.busy = true;
  const token = ++challengePicker.token;
  const user = state.user;
  const ids = mode === 'random' ? [] : [...challengePicker.selected];
  if (state.quiz?.submissionUnknown) preserveUnsyncedQuiz(user, state.quiz);
  if (DEMO_MODE && challengePicker.demoQuiz) {
    const demo = challengePicker.demoQuiz;
    const ordered = [...challengePicker.selected, ...challengePicker.candidates.map(w => w.meaningId).filter(id => !challengePicker.selected.has(id))].slice(0,10);
    state.quiz = {...demo, mode:state.mode, questions:ordered.map(id => demo.questions[challengePicker.candidates.findIndex(w => w.meaningId === id)])};
    state.session = {kind:'quiz',reviewRounds:[],remainingRecordIds:[],deferredRecordIds:[],analysisViewed:false};
    state.currentQuestion = 0;
    state.answers = new Array(state.quiz.questions.length).fill(null);
    saveQuizDraft(); challengePicker.selected.clear(); navigateTo('quiz'); renderQuestion(0);
    return;
  }
  renderChallengePicker();
  challengeStatus('正在准备你的挑战…');
  async function attempt() {
    if (token !== challengePicker.token || state.user !== user || state.currentPage !== 'challenge') return;
    try {
      const selection = challengePicker.pendingIds ? {mode:'custom', meaningIds:challengePicker.pendingIds} : {mode, meaningIds:ids};
      const data = await api('/api/quiz', {method:'POST', timeoutMs:70000, body:JSON.stringify({user, mode:'real', selection})});
      if (token !== challengePicker.token || state.user !== user || state.currentPage !== 'challenge') return;
      if (data.pending) {
        challengePicker.pendingIds = data.meaningIds;
        challengeStatus(`已准备 ${data.readyCount} / ${data.requiredCount} 题，准备好后会自动开始。你的选择会保留。`);
        challengePicker.timer = setTimeout(attempt, 5000);
        return;
      }
      if (data.code === 'CHALLENGE_NO_ELIGIBLE_WORDS' || data.code === 'CHALLENGE_COOLDOWN') {
        cancelChallengePreparation();
        await refreshChallengeCandidates();
        challengeStatus(data.code === 'CHALLENGE_COOLDOWN' ? '还需等待词义冷却满 18 小时，不会因为冷却而缩短试卷。' : '词库里暂时没有待考词义，可以先添加单词。');
        return;
      }
      challengePicker.busy = false;
      state.mode = 'real';
      if (data.level) state.level = data.level;
      clearActiveReview();
      state.session = {kind:'quiz', sourceTestId:null, reviewId:null, parentReviewId:null, round:0, firstResult:null, reviewRounds:[], remainingRecordIds:[], deferredRecordIds:[], analysisViewed:false};
      if (data.diagnostics?.resumed) showToast('先继续上次还没完成的挑战吧。', 'info');
      if (await enterFormalQuiz(data)) challengePicker.selected.clear();
      else { renderChallengePicker(); challengeStatus('这套题暂时未能打开，请重试。'); }
    } catch (error) {
      if (token !== challengePicker.token || state.user !== user) return;
      if (String(error.code || '').startsWith('CHALLENGE_SELECTION_')) {
        cancelChallengePreparation();
        await refreshChallengeCandidates();
        challengeStatus('有单词刚刚进入冷却或已掌握，请确认刷新后的选择。');
      } else {
        challengePicker.busy = false;
        challengeStatus('连接暂时中断，你的选择还在。请点开始按钮重试。');
        renderChallengePicker();
      }
    }
  }
  await attempt();
}
function stopChallengeWaiting() { cancelChallengePreparation(); renderChallengePicker(); challengeStatus('已停止等待，可以调整选择。'); }
if (typeof module !== 'undefined' && module.exports) module.exports = {filterChallengeWords, challengeSelectionSummary};
