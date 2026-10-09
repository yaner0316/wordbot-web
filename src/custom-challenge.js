'use strict';
const challengePicker = { user: null, mode: 'custom', candidates: [], selected: new Set(), filter: 'all', loading: false, busy: false, token: 0, timer: null, pendingIds: null };
const challengeStatusLabels = { pending: '未开始', recognized: '已认识', consolidating: '巩固中' };

function filterChallengeWords(words, search = '', status = 'all') {
  const query = search.trim().toLocaleLowerCase();
  return words.filter(w => (status === 'all' || w.status === status)
    && (!query || w.word.toLocaleLowerCase().includes(query)));
}
function groupChallengeWords(words) {
  const groups = new Map();
  for (const word of words) {
    const key = word.word.trim().toLocaleLowerCase();
    if (!groups.has(key)) groups.set(key, {word:word.word, meaningId:word.meaningId, senses:[]});
    groups.get(key).senses.push(word);
  }
  return [...groups.values()].map(group => ({...group,
    eligible:group.senses.every(sense => sense.eligible),
    cooldownEndsAt:group.senses.some(sense => !sense.eligible && !sense.cooldownEndsAt) ? null
      : group.senses.map(sense => sense.cooldownEndsAt).filter(Boolean).sort((a,b)=>Date.parse(b)-Date.parse(a))[0],
  }));
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
async function requestChallengeApi(path, options, token) {
  const user = state.user;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (state.user !== user || token !== challengePicker.token) throw new Error('CHALLENGE_CANCELLED');
    try { return await api(path, options); }
    catch (error) {
      const transient = error.code === 'REQUEST_TIMEOUT' || [502,503,504].includes(error.status)
        || /failed to fetch|fetch failed|networkerror|load failed/i.test(error.message || '');
      if (!transient || attempt === 2) throw error;
      challengeStatus('连接暂时中断，正在自动重连，你的选择会保留…');
      await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
}
async function openCustomChallenge(mode = 'custom') {
  if (!state.user) { showToast('请先登录', 'info'); return; }
  cancelChallengePreparation();
  challengePicker.mode = mode;
  if (mode === 'random') challengePicker.selected.clear();
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
    } else data = await requestChallengeApi(`/api/quiz/candidates?user=${encodeURIComponent(user)}`, {timeoutMs:20000}, token);
    if (state.user !== user || token !== challengePicker.token) return;
    challengePicker.candidates = data.candidates || [];
    // Refresh must not silently turn a whole-word choice into a partial choice.
    challengePicker.selected = new Set(groupChallengeWords(challengePicker.candidates)
      .filter(word => word.eligible && word.senses.every(sense => challengePicker.selected.has(sense.meaningId)))
      .flatMap(word => word.senses.map(sense => sense.meaningId)));
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
  const word = groupChallengeWords(challengePicker.candidates).find(w => w.senses.some(sense => sense.meaningId === id));
  if (!word?.eligible) return;
  challengePicker.pendingIds = null;
  challengePicker.mode = 'custom';
  const ids = word.senses.map(sense => sense.meaningId);
  if (ids.every(meaningId => challengePicker.selected.has(meaningId))) ids.forEach(meaningId => challengePicker.selected.delete(meaningId));
  else if (new Set([...challengePicker.selected, ...ids]).size <= 10) ids.forEach(meaningId => challengePicker.selected.add(meaningId));
  else { showToast(`这个单词需要 ${ids.length} 题，选入后会超过 10 题，请先取消其他单词。`, 'info'); return; }
  renderChallengePicker();
  $('challengeWordList')?.querySelectorAll('[data-meaning-id]').forEach(button => { if (button.dataset.meaningId === id) button.focus(); });
}
function renderChallengePicker() {
  const list = $('challengeWordList');
  if (!list) return;
  const summary = challengeSelectionSummary(challengePicker.candidates, challengePicker.selected);
  const matching = new Set(filterChallengeWords(challengePicker.candidates, $('challengeSearch')?.value || '', challengePicker.filter).map(word => word.meaningId));
  const words = groupChallengeWords(challengePicker.candidates).filter(word => word.senses.some(sense => matching.has(sense.meaningId)));
  $('challengeSelectionCount').textContent = `已选 ${summary.selected} / ${summary.total} 题`;
  $('challengeAutoCount').textContent = summary.total ? `系统补齐 ${summary.automatic} 题` : '暂时没有可挑战的单词';
  $('challengePoolCount').textContent = `${summary.available} 个词义可挑战`;
  $('challengeShortNote').textContent = summary.available < summary.total
    ? `本次需要 ${summary.total} 个词义，目前 ${summary.available} 个已满 18 小时，请等冷却结束后开考。`
    : summary.total > 0 && summary.total < 10
      ? `词库只有 ${summary.total} 个待考词义，这次考 ${summary.total} 题，不增减游戏时长。` : '每次最多 10 题；选中单词后，它的待考释义会一起考。';
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
    const checked = word.senses.every(sense => challengePicker.selected.has(sense.meaningId));
    const minutes = Math.max(1, Math.ceil((Date.parse(word.cooldownEndsAt) - Date.now()) / 60000));
    const cooling = !word.eligible ? (word.cooldownEndsAt ? `再等 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : '暂不可选，请刷新词库') : '';
    return `<button type="button" class="challenge-word ${checked ? 'is-selected' : ''}" data-meaning-id="${escapeHtml(word.meaningId)}" aria-pressed="${checked}" ${!word.eligible || challengePicker.busy ? 'disabled' : ''}>
      <span class="challenge-check" aria-hidden="true">${checked ? '✓' : ''}</span>
      <span class="challenge-word-content"><strong>${escapeHtml(word.word)}</strong>${word.senses.length > 1 ? `<span>${word.senses.length} 个待考释义 · 一起考</span>` : ''}</span>
      <span class="challenge-word-meta">${[...new Set(word.senses.map(sense => sense.status))].map(status => `<span class="challenge-tag ${escapeHtml(status)}">${challengeStatusLabels[status] || '未开始'}</span>`).join('')}${cooling ? `<small>${cooling}</small>` : ''}</span>
    </button>`;
  }).join('') || '<div class="challenge-empty">没有找到匹配的单词<br><small>试试英文单词，或换一个筛选。</small></div>';
  list.querySelectorAll('[data-meaning-id]').forEach(button => { button.onclick = () => toggleChallengeWord(button.dataset.meaningId); });
}
async function startRandomChallenge() {
  if (DEMO_MODE) return startQuiz();
  await openCustomChallenge('random');
  const summary = challengeSelectionSummary(challengePicker.candidates, new Set());
  if (state.currentPage === 'challenge' && !challengePicker.loading && summary.total && summary.available >= summary.total) {
    challengePicker.selected.clear();
    await beginSelectedChallenge('random');
  }
}
async function beginSelectedChallenge(mode = challengePicker.mode) {
  if (challengePicker.busy) return;
  challengePicker.mode = mode;
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
      const data = await requestChallengeApi('/api/quiz', {method:'POST', timeoutMs:30000, body:JSON.stringify({user, mode:'real', selection})}, token);
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
