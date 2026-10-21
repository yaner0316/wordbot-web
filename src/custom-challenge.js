'use strict';
const challengePicker = { user: null, mode: 'custom', candidates: [], selected: new Set(), filter: 'all', loading: false, busy: false, token: 0, timer: null, pendingIds: null, missingWords: [] };
const CHALLENGE_WAIT_MS = 120000;
const challengeStatusLabels = { pending: '未开始', recognized: '已认识', consolidating: '巩固中' };

function filterChallengeWords(words, search = '', status = 'all') {
  const query = search.trim().toLocaleLowerCase();
  return words.filter(w => (status === 'all' || w.status === status)
    && (!query || w.word.toLocaleLowerCase().includes(query)));
}
async function renderHomeChallengeAvailability(status, level) {
  const host = $('homeChallengeAvailability');
  if (!host) return;
  if (status?.operation === 'querying') { host.textContent = '正在确认本场开考条件…'; return; }
  const user = state.user;
  try {
    const data = DEMO_MODE ? {candidates:Array.from({length:10},()=>({eligible:true}))}
      : await api(`/api/quiz/candidates?user=${encodeURIComponent(user)}`,{timeoutMs:20000,cache:'no-store'});
    if (state.user !== user) return;
    const ready = status?.queryError ? null : getLevelCacheReadyCount(status,level);
    const availability = challengeAvailability(data.candidates || [],{ready,queryError:!!status?.queryError});
    host.textContent = availability.message;
    document.querySelectorAll('.challenge-entry').forEach(button => {
      button.classList.toggle('is-unavailable',button.dataset.challengeMode === 'random' && !availability.canStart);
      const label = button.querySelector('strong');
      if (label) label.textContent = button.dataset.challengeMode === 'random'
        ? availability.canStart ? '开始随机挑战我吧！' : availability.timeReady ? '查看随机挑战准备' : '查看开考条件'
        : '自选单词，练一练';
    });
  } catch (_) { if (state.user === user) host.textContent = '开考状态暂时未能确认，进入后可刷新重试。'; }
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
  challengePicker.missingWords = [];
}
function challengeAvailability(words, {ready = null, queryError = false} = {}) {
  const required = Math.min(10, words.length);
  const available = words.filter(word => word.eligible).length;
  const ends = words.filter(word => !word.eligible).map(word => word.cooldownEndsAt)
    .filter(value => Number.isFinite(Date.parse(value))).sort((a,b) => Date.parse(a)-Date.parse(b));
  const cooldownEndsAt = available < required ? ends[required - available - 1] || null : null;
  const timeReady = required > 0 && available >= required;
  const canStart = timeReady && !queryError && (ready === null || ready >= required);
  const when = cooldownEndsAt ? `预计 ${new Date(cooldownEndsAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})} 满足本场冷却条件；届时仍需题目就绪。` : '';
  const message = queryError ? '开考状态暂时未能确认，请刷新重试。'
    : !required ? '暂无待考词义，可以先录入新词。'
    : !timeReady ? `${available} 个词义已符合时间条件，本场需 ${required} 题，暂不能开始。${when}`
    : ready !== null && ready < required ? `本场 ${required} 个词义已符合时间条件，题目正在准备，开始后最多等待 2 分钟。`
    : `本场 ${required} 题可开始${required < 10 ? '，不增减游戏时长' : ''}。`;
  return {required, available, timeReady, canStart, cooldownEndsAt, message};
}
function challengeStatus(message) {
  const el = $('challengeStatus');
  if (el) el.textContent = message;
}
async function requestChallengeApi(path, options, token, deadline = Infinity) {
  const user = state.user;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (state.user !== user || token !== challengePicker.token) throw new Error('CHALLENGE_CANCELLED');
    if (Date.now() >= deadline) throw new Error('CHALLENGE_WAIT_EXPIRED');
    try { return await api(path, {...options, timeoutMs:Math.min(options.timeoutMs, deadline - Date.now())}); }
    catch (error) {
      const transient = error.code === 'REQUEST_TIMEOUT' || [502,503,504].includes(error.status)
        || /failed to fetch|fetch failed|networkerror|load failed/i.test(error.message || '');
      if (!transient || attempt === 2) throw error;
      challengeStatus(challengePicker.mode === 'random' ? '连接暂时中断，正在自动重连…' : '连接暂时中断，正在自动重连，你的选择会保留…');
      await new Promise(resolve => setTimeout(resolve, Math.min(1500 * (attempt + 1), Math.max(0, deadline - Date.now()))));
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
    } else data = await requestChallengeApi(`/api/quiz/candidates?user=${encodeURIComponent(user)}&mode=${challengePicker.mode === 'custom' ? 'practice' : 'real'}`, {timeoutMs:20000}, token);
    if (state.user !== user || token !== challengePicker.token) return;
    challengePicker.candidates = data.candidates || [];
    // Refresh must not silently turn a whole-word choice into a partial choice.
    challengePicker.selected = new Set(groupChallengeWords(challengePicker.candidates)
      .filter(word => word.eligible && word.senses.every(sense => challengePicker.selected.has(sense.meaningId)))
      .flatMap(word => word.senses.map(sense => sense.meaningId)));
    challengeStatus('');
  } catch (error) {
    if (state.user === user && token === challengePicker.token) challengeStatus(challengePicker.mode === 'random'
      ? '开考条件暂时未能确认，请点「开始随机挑战」重试。' : '词库暂时没能加载，请点「刷新词库」再试。');
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
  challengePicker.missingWords = [];
  challengePicker.mode = 'custom';
  challengePicker.candidates = challengePicker.candidates.map(candidate => ({...candidate, eligible:true, cooldownEndsAt:null}));
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
  renderChallengeMissingWords();
  const summary = challengeSelectionSummary(challengePicker.candidates, challengePicker.selected);
  const practice = challengePicker.mode === 'custom';
  $('pageChallenge')?.classList?.toggle('is-random', !practice);
  if ($('challengeWordPicker')) $('challengeWordPicker').hidden = !practice;
  if ($('challengeCounts')) $('challengeCounts').hidden = !practice;
  if ($('challengeDescription')) $('challengeDescription').textContent = practice
    ? '挑几个想练的单词；同一单词的待考释义会一起考。' : '系统会随机安排本场题目，准备好后自动开始。';
  if ($('challengeTitle')) $('challengeTitle').textContent = practice ? '今天，想练哪些词？' : '准备随机挑战';
  const matching = new Set(filterChallengeWords(challengePicker.candidates, $('challengeSearch')?.value || '', challengePicker.filter).map(word => word.meaningId));
  const words = groupChallengeWords(challengePicker.candidates).filter(word => word.senses.some(sense => matching.has(sense.meaningId)));
  $('challengeSelectionCount').textContent = `已选 ${summary.selected} / ${summary.total} 题`;
  $('challengeAutoCount').textContent = summary.total ? `系统补齐 ${summary.automatic} 题` : '暂时没有可挑战的单词';
  const availability = challengeAvailability(challengePicker.candidates);
  $('challengePoolCount').textContent = practice ? `${summary.available} 个词义可练习` : `${summary.available} 个词义已符合时间条件`;
  $('challengeShortNote').textContent = practice ? '自选练习：不计掌握、不增减游戏时间，不影响正式测试冷却。'
    : summary.available < summary.total
    ? availability.message
    : summary.total > 0 && summary.total < 10
      ? `词库只有 ${summary.total} 个待考词义，这次考 ${summary.total} 题，不增减游戏时长。` : `本场由系统随机安排 ${summary.total} 题。`;
  const start = $('challengeStart');
  start.disabled = challengePicker.busy || challengePicker.loading || (practice && (!summary.total || summary.available < summary.total));
  start.textContent = challengePicker.busy ? '正在准备题目…' : !availability.timeReady ? '本场暂不能开始' : practice ? '就练这些，开始练习' : '开始随机挑战';
  $('challengeCancel').hidden = !challengePicker.busy;
  $('challengeCancel').textContent = practice ? '先不等了，调整选择' : '先不等了，返回首页';
  $('challengeRefresh').disabled = challengePicker.busy || challengePicker.loading;
  document.querySelectorAll('[data-challenge-filter]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.challengeFilter === challengePicker.filter));
  });
  if (!practice) { list.innerHTML = ''; return; }
  if (challengePicker.loading && !words.length) { list.innerHTML = '<div class="challenge-empty">正在打开你的词库…</div>'; return; }
  list.innerHTML = words.map(word => {
    const checked = word.senses.every(sense => challengePicker.selected.has(sense.meaningId));
    const minutes = Math.max(1, Math.ceil((Date.parse(word.cooldownEndsAt) - Date.now()) / 60000));
    const cooling = !word.eligible ? (word.cooldownEndsAt ? `再等 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : '暂不可选，请刷新词库') : '';
    return `<button type="button" class="challenge-word ${checked ? 'is-selected' : ''}" data-meaning-id="${escapeHtml(word.meaningId)}" aria-pressed="${checked}" ${!word.eligible || challengePicker.busy || challengePicker.loading ? 'disabled' : ''}>
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
  const deadline = Date.now() + CHALLENGE_WAIT_MS;
  const user = state.user;
  const ids = mode === 'random' ? [] : [...challengePicker.selected];
  if (state.quiz?.submissionUnknown) preserveUnsyncedQuiz(user, state.quiz);
  if (DEMO_MODE && challengePicker.demoQuiz) {
    const demo = challengePicker.demoQuiz;
    const ordered = [...challengePicker.selected, ...challengePicker.candidates.map(w => w.meaningId).filter(id => !challengePicker.selected.has(id))].slice(0,10);
    state.mode = mode === 'custom' ? 'practice' : 'real';
    state.quiz = {...demo, mode:state.mode, questions:ordered.map(id => demo.questions[challengePicker.candidates.findIndex(w => w.meaningId === id)])};
    state.session = {kind:'quiz',reviewRounds:[],remainingRecordIds:[],deferredRecordIds:[],analysisViewed:false};
    state.currentQuestion = 0;
    state.answers = new Array(state.quiz.questions.length).fill(null);
    saveQuizDraft(); challengePicker.selected.clear(); navigateTo('quiz'); renderQuestion(0);
    return;
  }
  renderChallengePicker();
  challengeStatus('正在准备你的挑战…');
  function stopAtDeadline() {
    if (mode === 'custom' && challengePicker.pendingIds) challengePicker.selected = new Set(challengePicker.pendingIds);
    challengePicker.busy = false;
    challengePicker.token++;
    clearTimeout(challengePicker.timer);
    challengePicker.timer = null;
    renderChallengePicker();
    challengeStatus(mode === 'random'
      ? '随机挑战暂时未能备齐，已停止自动等待。可以稍后重试，或先复习历史错题。'
      : '这套题暂时未能备齐，已停止自动等待。你的选择还在，可以换词，或稍后点开始重试。');
  }
  async function attempt() {
    if (token !== challengePicker.token || state.user !== user || state.currentPage !== 'challenge') return;
    if (Date.now() >= deadline) { stopAtDeadline(); return; }
    try {
      const selection = mode === 'random' ? {mode:'random', meaningIds:[]}
        : {mode:'custom', meaningIds:challengePicker.pendingIds || ids};
      const data = await requestChallengeApi('/api/quiz', {method:'POST', timeoutMs:30000, body:JSON.stringify({user, mode:'real', selection})}, token, deadline);
      if (token !== challengePicker.token || state.user !== user || state.currentPage !== 'challenge') return;
      if (data.pending) {
        challengePicker.pendingIds = data.meaningIds;
        challengePicker.missingWords = data.missingWords || [];
        renderChallengeMissingWords();
        if (Date.now() >= deadline) { stopAtDeadline(); return; }
        challengeStatus(`已准备 ${data.readyCount} / ${data.requiredCount} 题，准备好后会自动开始，最多自动等 2 分钟。${mode === 'custom' ? '也可以现在换词，你的其他选择会保留。' : ''}`);
        challengePicker.timer = setTimeout(attempt, Math.min(5000, Math.max(0, deadline - Date.now())));
        return;
      }
      if (data.code === 'CHALLENGE_NO_ELIGIBLE_WORDS' || data.code === 'CHALLENGE_COOLDOWN') {
        cancelChallengePreparation();
        await refreshChallengeCandidates();
        challengeStatus(data.code === 'CHALLENGE_COOLDOWN' ? '还需等待词义冷却满 18 小时，不会因为冷却而缩短试卷。' : '词库里暂时没有待考词义，可以先添加单词。');
        return;
      }
      challengePicker.busy = false;
      state.mode = data.mode || (mode === 'custom' ? 'practice' : 'real');
      if (data.level) state.level = data.level;
      clearActiveReview();
      state.session = {kind:'quiz', sourceTestId:null, reviewId:null, parentReviewId:null, round:0, firstResult:null, reviewRounds:[], remainingRecordIds:[], deferredRecordIds:[], analysisViewed:false};
      if (data.diagnostics?.resumed) showToast('先继续上次还没完成的挑战吧。', 'info');
      if (await enterFormalQuiz(data)) challengePicker.selected.clear();
      else { renderChallengePicker(); challengeStatus('这套题暂时未能打开，请重试。'); }
    } catch (error) {
      if (token !== challengePicker.token || state.user !== user) return;
      if (Date.now() >= deadline || error.message === 'CHALLENGE_WAIT_EXPIRED') { stopAtDeadline(); return; }
      if (String(error.code || '').startsWith('CHALLENGE_SELECTION_')) {
        cancelChallengePreparation();
        await refreshChallengeCandidates();
        challengeStatus(mode === 'random' ? '开考条件刚刚发生变化，请稍后重试随机挑战。' : '有单词刚刚进入冷却或已掌握，请确认刷新后的选择。');
      } else {
        challengePicker.busy = false;
        challengeStatus(mode === 'random' ? '连接暂时中断，请点「开始随机挑战」重试。' : '连接暂时中断，你的选择还在。请点开始按钮重试。');
        renderChallengePicker();
      }
    }
  }
  await attempt();
}
function renderChallengeMissingWords() {
  const panel = $('challengeMissingWords');
  if (!panel) return;
  if (challengePicker.mode === 'random') { panel.innerHTML = ''; return; }
  const labels = {queued:'正在排队补题',generating:'正在准备题目',retry_wait:'这次还没备好，后台会继续尝试',unavailable:'暂时未能备好'};
  panel.innerHTML = challengePicker.missingWords.map(word => `<div class="challenge-missing-word"><strong>${escapeHtml(word.word)}</strong><span>${labels[word.state] || labels.unavailable}</span><button type="button" data-replace-meaning="${escapeHtml(word.meaningId)}">换掉这个词</button></div>`).join('');
  panel.querySelectorAll('[data-replace-meaning]').forEach(button => { button.onclick = () => replaceChallengeWord(button.dataset.replaceMeaning); });
}
function stopChallengeWaiting() {
  if (challengePicker.mode === 'random') {
    cancelChallengePreparation();
    challengePicker.selected.clear();
    navigateTo('home');
    return;
  }
  if (challengePicker.pendingIds) challengePicker.selected = new Set(challengePicker.pendingIds);
  challengePicker.mode = 'custom';
  challengePicker.candidates = challengePicker.candidates.map(candidate => ({...candidate, eligible:true, cooldownEndsAt:null}));
  cancelChallengePreparation(); renderChallengePicker(); challengeStatus('已停止等待。调整选词后将作为自选练习，不计掌握或游戏时间。');
}
function replaceChallengeWord(id) {
  const word = groupChallengeWords(challengePicker.candidates).find(word => word.senses.some(sense => sense.meaningId === id));
  if (!word) return;
  stopChallengeWaiting();
  word.senses.forEach(sense => challengePicker.selected.delete(sense.meaningId));
  renderChallengePicker();
  challengeStatus('其他选择已保留。换词后属于自选练习，不计掌握或游戏时间。');
}
if (typeof module !== 'undefined' && module.exports) module.exports = {filterChallengeWords, challengeSelectionSummary, challengeAvailability};
