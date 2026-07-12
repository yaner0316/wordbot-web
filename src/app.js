// ========== State ==========
const {
  adaptDemoContextByLevel,
  buildOptionMeaningsExplanation,
  buildQuestionExplanation,
  buildMeaningReviewExplanation,
  formatOptionDisplayText,
  normalizeArticleContext,
  optionWord,
} = WordBotQuizLogic;
const {
  buildReviewSummary,
  getResultActions,
} = WordBotReviewFlow;
const DEFAULT_LEVEL = '中学';
const LEVEL_LABELS = { '中学': '初中' };
const STATUS_LABELS = {
  Pending: '待学习',
  Recognized: '已认识',
  Consolidating: '巩固中',
  Mastered: '已掌握',
};
const STATUS_OPTIONS = ['Pending', 'Recognized', 'Consolidating', 'Mastered'];
const parentWordLibraryState = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  words: [],
};
function formatLearningLevel(level) {
  return LEVEL_LABELS[level] || level || DEFAULT_LEVEL;
}

function formatWordStatus(status) {
  return STATUS_LABELS[status] || status || STATUS_LABELS.Pending;
}
const SESSION_USER_KEY = 'wordbot:session-user';
const LOCAL_AUTH_USERS_KEY = 'wordbot:local-auth-users';
const GAME_TIME_BANK_KEY_PREFIX = 'wordbot:game-time-bank:';
const GAME_TIME_REWARD_CLAIM_KEY_PREFIX = 'wordbot:game-time-reward-claims:';
const ANIMAL_GARDEN_STATE_KEY_PREFIX = 'wordbot:animal-garden:';
const REWARD_GAME_ASSET_MANIFEST = 'assets/reward-game/v1/manifest.json';
const SEEDED_LOCAL_USERS = ['yusi', 'qiuqiu'];
const state = {
  user: null,
  authMode: 'login',
  parentAccess: false,
  parentAuth: null,
  level: DEFAULT_LEVEL,
  mode: 'real',
  historyMode: 'real',
  currentPage: 'login',
  historyInitialized: false,
  quiz: null,
  currentQuestion: 0,
  answers: [],
  confidences: [],
  users: [],
  learningSettings: null,
  quizDiagnostics: null,
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

const URL_PARAMS = new URLSearchParams(window.location.search);
const API_BASE = (URL_PARAMS.get('api') || window.WORDBOT_CONFIG?.API_BASE || '').replace(/\/$/, '');
const DEMO_MODE = URL_PARAMS.get('demo') === '1';
const DEV_MODE = URL_PARAMS.get('dev') === '1' || DEMO_MODE;
const GAME_PREVIEW_MODE = URL_PARAMS.get('game') === '1' && DEMO_MODE;

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
  const types = level === '小学' ? [1,1,1,1,1,1,1,1,1,1] : [1,1,1,1,1,1,2,2,3,3];
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
  const consolidating = Math.floor(total * 0.25);
  const recognized = Math.floor(total * 0.2);
  const pending = total - mastered;
  const totalTests = 5;
  const correctCount = 32;
  const totalQuestions = 50;
  return {
    totalWords: total, masteredWords: mastered, consolidatingWords: consolidating, recognizedWords: recognized, unseenWords: Math.max(0, total - mastered - consolidating - recognized), pendingWords: pending,
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
    return { eligible: true, minutes: 12, tier: 'perfect', reason: 'perfect_score' };
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

function getLocalAuthUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const users = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    return Array.from(new Set([...SEEDED_LOCAL_USERS, ...users]));
  } catch {
    return [...SEEDED_LOCAL_USERS];
  }
}

function saveLocalAuthUsers(users) {
  localStorage.setItem(LOCAL_AUTH_USERS_KEY, JSON.stringify(Array.from(new Set(users))));
}

function getSessionUser() {
  return localStorage.getItem(SESSION_USER_KEY) || '';
}

function setSessionUser(user) {
  localStorage.setItem(SESSION_USER_KEY, user);
}

function clearSessionUser() {
  localStorage.removeItem(SESSION_USER_KEY);
}

function gameTimeBankKey(user) {
  return `${GAME_TIME_BANK_KEY_PREFIX}${user}`;
}

function gameTimeRewardClaimKey(user) {
  return `${GAME_TIME_REWARD_CLAIM_KEY_PREFIX}${user}`;
}

function getBankedGameMinutes(user = state.user) {
  if (!user) return 0;
  const minutes = Number(localStorage.getItem(gameTimeBankKey(user)) || 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function setBankedGameMinutes(minutes, user = state.user) {
  if (!user) return 0;
  const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
  localStorage.setItem(gameTimeBankKey(user), String(safeMinutes));
  return safeMinutes;
}

function getClaimedGameRewardIds(user = state.user) {
  if (!user) return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(gameTimeRewardClaimKey(user)) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function markGameRewardClaimed(claimId, user = state.user) {
  if (!user || !claimId) return;
  const claimed = getClaimedGameRewardIds(user);
  claimed.add(String(claimId));
  localStorage.setItem(gameTimeRewardClaimKey(user), JSON.stringify([...claimed]));
}

function buildQuizDiagnosticsSummary(quizData) {
  const diagnostics = quizData?.diagnostics || null;
  if (!diagnostics) return null;
  return {
    source: quizData.source || '',
    level: formatLearningLevel(diagnostics.level || quizData.level || state.level || ''),
    readyCount: diagnostics.readyCount,
    requiredCount: diagnostics.requiredCount,
    fallbackUsed: Boolean(diagnostics.fallbackUsed),
    cacheReadLatencyMs: diagnostics.cacheReadLatencyMs,
    liveGenerationLatencyMs: diagnostics.liveGenerationLatencyMs,
    testRecordWriteLatencyMs: diagnostics.testRecordWriteLatencyMs,
    cacheUsageWriteLatencyMs: diagnostics.cacheUsageWriteLatencyMs,
  };
}

function renderQuizDiagnosticsPanel() {
  const diagnostics = state.quizDiagnostics;
  if (!diagnostics) return '';
  const sourceLabel = diagnostics.source === 'question_cache' ? '预生成题库' : '实时生成';
  const readyText = diagnostics.readyCount === null || diagnostics.readyCount === undefined
    ? '未读取'
    : `${diagnostics.readyCount}/${diagnostics.requiredCount || 10}`;
  const cacheLatency = diagnostics.cacheReadLatencyMs === null || diagnostics.cacheReadLatencyMs === undefined
    ? '-'
    : `${diagnostics.cacheReadLatencyMs}ms`;
  const liveLatency = diagnostics.liveGenerationLatencyMs === null || diagnostics.liveGenerationLatencyMs === undefined
    ? '-'
    : `${diagnostics.liveGenerationLatencyMs}ms`;
  const testWriteLatency = diagnostics.testRecordWriteLatencyMs === null || diagnostics.testRecordWriteLatencyMs === undefined
    ? '-'
    : `${diagnostics.testRecordWriteLatencyMs}ms`;
  const cacheWriteLatency = diagnostics.cacheUsageWriteLatencyMs === null || diagnostics.cacheUsageWriteLatencyMs === undefined
    ? '-'
    : `${diagnostics.cacheUsageWriteLatencyMs}ms`;
  return `<div class="parent-cache-status quiz-diagnostics-panel">
    <span>本次出题来源</span>
    <strong>${escapeHtml(sourceLabel)}</strong>
    <small>level: ${escapeHtml(diagnostics.level || '-')}；ready: ${escapeHtml(readyText)}；cache: ${escapeHtml(cacheLatency)}；testWrite: ${escapeHtml(testWriteLatency)}；cacheWrite: ${escapeHtml(cacheWriteLatency)}；live: ${escapeHtml(liveLatency)}；fallback: ${diagnostics.fallbackUsed ? 'yes' : 'no'}</small>
  </div>`;
}
function addGameRewardToBank(reward, user = state.user, claimId = '') {
  if (!reward?.eligible || !reward.minutes || !user) return getBankedGameMinutes(user);
  const normalizedClaimId = String(claimId || '').trim();
  if (normalizedClaimId && getClaimedGameRewardIds(user).has(normalizedClaimId)) {
    return getBankedGameMinutes(user);
  }
  const minutes = setBankedGameMinutes(getBankedGameMinutes(user) + Number(reward.minutes), user);
  markGameRewardClaimed(normalizedClaimId, user);
  return minutes;
}

function animalGardenStateKey(user = state.user) {
  return `${ANIMAL_GARDEN_STATE_KEY_PREFIX}${user}`;
}

function getAnimalGardenState(user = state.user) {
  const fallback = { hearts: 0, feed: 0, outfit: '草帽', visits: 0, lastAction: 'idle', lastGain: {} };
  if (!user) return fallback;
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(animalGardenStateKey(user)) || '{}') };
  } catch {
    return fallback;
  }
}

function setAnimalGardenState(nextState, user = state.user) {
  if (!user) return nextState;
  localStorage.setItem(animalGardenStateKey(user), JSON.stringify(nextState));
  return nextState;
}

function normalizeGardenOutfit(outfit) {
  return ({ '红围巾': '莓果领结', '星星背包': '星星挎包' }[outfit] || outfit || '草帽');
}

const REWARD_GAME_FALLBACK_ASSETS = {
  fallback: {
    character: 'assets/reward-game/v1/placeholders/character.svg',
    habitat: 'assets/reward-game/v1/placeholders/habitat.svg',
    equipment: 'assets/reward-game/v1/placeholders/equipment.svg',
    reward: 'assets/reward-game/v1/placeholders/item.svg',
  },
  habitats: { meadowDay: 'assets/reward-game/v1/habitats/meadow-day.svg' },
  characters: {
    wordDragon: {
      stage00: { idle: 'assets/reward-game/v1/characters/word-dragon/stage-00/idle.svg' },
      stage01: {
        idle: 'assets/reward-game/v1/characters/word-dragon/stage-01/idle.svg',
        happy: 'assets/reward-game/v1/characters/word-dragon/stage-01/happy.svg',
        care: 'assets/reward-game/v1/characters/word-dragon/stage-01/care.svg',
        collect: 'assets/reward-game/v1/characters/word-dragon/stage-01/collect.svg',
        equip: 'assets/reward-game/v1/characters/word-dragon/stage-01/equip.svg',
      },
    },
  },
  companions: { pigKnight: { idle: 'assets/reward-game/v1/companions/pig-knight/idle.svg' } },
  equipment: {
    strawHat: 'assets/reward-game/v1/equipment/straw-hat.svg',
    berryBow: 'assets/reward-game/v1/equipment/berry-bow.svg',
    starSatchel: 'assets/reward-game/v1/equipment/star-satchel.svg',
    explorerBell: 'assets/reward-game/v1/equipment/explorer-bell.svg',
  },
  rewards: {
    wordCrystal: 'assets/reward-game/v1/rewards/word-crystal.svg',
    feedCarrot: 'assets/reward-game/v1/rewards/feed-carrot.svg',
    intimacyStar: 'assets/reward-game/v1/rewards/intimacy-star.svg',
  },
};
let rewardGameAssetManifestCache = null;

function getGardenOutfitAssetKey(outfit) {
  return ({
    '草帽': 'strawHat',
    '莓果领结': 'berryBow',
    '星星挎包': 'starSatchel',
    '探险铃': 'explorerBell',
  }[normalizeGardenOutfit(outfit)] || 'strawHat');
}

function getGardenCharacterState(action) {
  return ({ care: 'care', collect: 'collect', outfit: 'equip' }[action] || 'idle');
}

function getGardenDropAssetKey(action) {
  return ({ care: 'intimacyStar', collect: 'feedCarrot', outfit: 'wordCrystal' }[action] || 'wordCrystal');
}

async function loadRewardGameAssetManifest() {
  if (rewardGameAssetManifestCache) return rewardGameAssetManifestCache;
  try {
    const response = await fetch(REWARD_GAME_ASSET_MANIFEST, { cache: 'no-cache' });
    if (!response.ok) throw new Error('manifest load failed');
    rewardGameAssetManifestCache = { ...REWARD_GAME_FALLBACK_ASSETS, ...(await response.json()) };
  } catch {
    rewardGameAssetManifestCache = REWARD_GAME_FALLBACK_ASSETS;
  }
  return rewardGameAssetManifestCache;
}

function getGardenLevel(garden) {
  const score = (garden.hearts || 0) + (garden.feed || 0) + (garden.visits || 0);
  return Math.max(1, Math.min(9, Math.floor(score / 12) + 1));
}

function getGardenMood(garden) {
  if ((garden.hearts || 0) >= 24) return '开心';
  if ((garden.feed || 0) <= 2) return '期待投喂';
  return '安静陪伴';
}

function getGardenProgress(value, step) {
  return Math.min(100, Math.round(((value || 0) % step) / step * 100));
}

function renderGardenMeters(garden) {
  const hearts = garden.hearts || 0;
  const feed = garden.feed || 0;
  const visits = garden.visits || 0;
  const deltas = garden.lastGain || {};
  const rows = [
    { key: 'hearts', label: '亲密', icon: '♥', value: hearts, max: 10, color: '#E85D82' },
    { key: 'feed', label: '饲料', icon: '◆', value: feed, max: 8, color: '#E6A23C' },
    { key: 'visits', label: '来访', icon: '●', value: visits, max: 6, color: '#4C8ED9' },
  ];
  return `
    <div class="garden-meters" aria-label="花园资源">
      ${rows.map(row => `
        <div class="garden-meter-card ${row.key}">
          <div class="garden-meter-head"><span>${row.icon} ${row.label}</span><strong>${escapeHtml(row.value)}</strong>${deltas[row.key] ? `<em>+${escapeHtml(deltas[row.key])}</em>` : ''}</div>
          <div class="garden-meter-track"><span class="garden-meter-fill" style="width:${getGardenProgress(row.value, row.max)}%;background:${row.color};"></span></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderGardenInventory(garden) {
  const feed = garden.feed || 0;
  const foods = [
    { icon: '🥕', name: '胡萝卜', count: Math.max(1, Math.ceil(feed / 4)) },
    { icon: '🍓', name: '莓果', count: Math.max(0, Math.floor(feed / 5)) },
    { icon: '🌽', name: '玉米', count: Math.max(0, Math.floor(feed / 7)) },
  ];
  return `
    <div class="garden-inventory" aria-label="饲料库存">
      <div class="garden-section-label">饲料库存</div>
      <div class="garden-inventory-row">
        ${foods.map(item => `<span class="garden-inventory-item ${item.count ? '' : 'locked'}" title="${escapeHtml(item.name)}"><b>${item.icon}</b><span>${escapeHtml(item.name)}</span><small>x${escapeHtml(item.count)}</small></span>`).join('')}
      </div>
    </div>
  `;
}

function renderGardenStageStats(garden) {
  const stats = [
    { key: 'hearts', label: '亲密', value: garden.hearts || 0 },
    { key: 'feed', label: '饲料', value: garden.feed || 0 },
    { key: 'visits', label: '来访', value: garden.visits || 0 },
  ];
  return `
    <div class="garden-stage-stat-row" aria-label="花园状态">
      ${stats.map(item => `<span class="garden-stage-stat ${item.key}"><small>${item.label}</small><strong>${escapeHtml(item.value)}</strong></span>`).join('')}
    </div>
  `;
}

function renderGardenWardrobe(garden) {
  const current = normalizeGardenOutfit(garden.outfit);
  const outfits = [
    { name: '草帽', icon: '⌒' },
    { name: '莓果领结', icon: '◆' },
    { name: '星星挎包', icon: '★' },
    { name: '探险铃', icon: '◔' },
  ];
  return `
    <div class="garden-wardrobe" aria-label="动物装备">
      <div class="garden-section-label">装备</div>
      <div class="garden-wardrobe-row">
        ${outfits.map(item => `<span class="garden-wardrobe-item ${item.name === current ? 'active' : ''}"><b>${item.icon}</b>${escapeHtml(item.name)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderAnimalGardenGame() {
  const minutes = getBankedGameMinutes();
  const garden = getAnimalGardenState();
  const level = getGardenLevel(garden);
  const mood = getGardenMood(garden);
  const outfitName = normalizeGardenOutfit(garden.outfit);
  const actionText = {
    care: '亲密星落进花园，花丛长高了',
    collect: '收到了新的饲料，食盆更满了',
    outfit: `换上了${outfitName}`,
    idle: '完成复习得到的小游戏时间可以慢慢用',
  }[garden.lastAction || 'idle'];
  return `
    <div class="animal-garden-game garden-v3" id="animalGardenGame">
      <div
        class="animal-garden-stage garden-art-stage"
        id="animalGardenArtStage"
        data-action="${escapeHtml(garden.lastAction || 'idle')}"
        data-outfit="${escapeHtml(outfitName)}"
        aria-label="词语花园美术预览"
      >
        <div class="garden-art-fallback">词语花园美术资源加载中...</div>
      </div>
      <div class="garden-stage-overlay" aria-label="花园状态概览">
        <div class="garden-level-badge">Lv.${escapeHtml(level)} · ${escapeHtml(mood)}</div>
        ${renderGardenStageStats(garden)}
        <div class="garden-action-pop ${garden.lastAction || 'idle'}">${escapeHtml(actionText)}</div>
      </div>
      <div class="animal-garden-panel">
        <div class="animal-garden-topline">
          <div><div class="animal-garden-game-title">动物花园</div><small>照顾、收集和换装都会消耗 1 分钟</small></div>
          <div class="animal-garden-game-bank">可玩时间 <strong>${escapeHtml(minutes)}</strong> 分钟</div>
        </div>
        ${renderGardenMeters(garden)}
        ${renderGardenInventory(garden)}
        ${renderGardenWardrobe(garden)}
        <div class="animal-garden-actions">
          <button class="btn btn-primary btn-small" onclick="playAnimalGardenAction('care')">照顾</button>
          <button class="btn btn-secondary btn-small" onclick="playAnimalGardenAction('collect')">收集</button>
          <button class="btn btn-secondary btn-small" onclick="playAnimalGardenAction('outfit')">装备</button>
        </div>
        <button class="btn btn-outline btn-small" onclick="closeAnimalGardenGame()">回到学习总结</button>
      </div>
    </div>
  `;
}

async function mountCurrentRewardGardenArt() {
  const stage = $('animalGardenArtStage');
  if (!stage) return;
  const garden = getAnimalGardenState();
  const outfitName = normalizeGardenOutfit(garden.outfit);
  const action = garden.lastAction || 'idle';
  const manifest = await loadRewardGameAssetManifest();
  const characterState = getGardenCharacterState(action);
  const character = manifest.characters?.wordDragon?.stage01?.[characterState]
    || manifest.characters?.wordDragon?.stage01?.idle
    || manifest.fallback?.character;
  const habitat = manifest.habitats?.meadowDay || manifest.fallback?.habitat;
  const equipment = manifest.equipment?.[getGardenOutfitAssetKey(outfitName)] || manifest.fallback?.equipment;
  const companion = (garden.visits || 0) >= 50 ? manifest.companions?.pigKnight?.idle : '';
  const drop = action === 'idle' ? '' : (manifest.rewards?.[getGardenDropAssetKey(action)] || manifest.fallback?.reward);
  const layers = [
    '<img class="garden-art-habitat" src="' + escapeHtml(habitat) + '" alt="" aria-hidden="true">',
    '<img class="garden-art-character ' + escapeHtml(characterState) + '" src="' + escapeHtml(character) + '" alt="词灵幼龙占位图">',
    '<img class="garden-art-equipment ' + escapeHtml(getGardenOutfitAssetKey(outfitName)) + '" src="' + escapeHtml(equipment) + '" alt="' + escapeHtml(outfitName) + '">',
  ];
  if (companion) layers.push('<img class="garden-art-companion" src="' + escapeHtml(companion) + '" alt="里程碑伙伴占位图">');
  if (drop) layers.push('<img class="garden-art-drop ' + escapeHtml(action) + '" src="' + escapeHtml(drop) + '" alt="奖励掉落占位图">');
  stage.innerHTML = layers.join('');
}

function playAnimalGardenAction(action) {
  const minutes = getBankedGameMinutes();
  if (minutes <= 0) {
    showToast('小游戏时间已经用完，下次学习再来玩', 'info');
    return;
  }
  const garden = getAnimalGardenState();
  const outfits = ['草帽', '莓果领结', '星星挎包', '探险铃'];
  const gain = {
    hearts: action === 'care' ? 2 : 1,
    feed: action === 'collect' ? 2 : 1,
    visits: action === 'outfit' ? 2 : 1,
  };
  const currentOutfit = normalizeGardenOutfit(garden.outfit);
  const nextOutfitIndex = (outfits.indexOf(currentOutfit) + 1 + outfits.length) % outfits.length;
  const next = {
    ...garden,
    visits: (garden.visits || 0) + gain.visits,
    hearts: (garden.hearts || 0) + gain.hearts,
    feed: (garden.feed || 0) + gain.feed,
    outfit: action === 'outfit' ? outfits[nextOutfitIndex] : currentOutfit,
    lastAction: action,
    lastGain: gain,
    lastActionAt: Date.now(),
  };
  setAnimalGardenState(next);
  setBankedGameMinutes(minutes - 1);
  const host = $('animalGardenMount');
  if (host) {
    host.innerHTML = renderAnimalGardenGame();
    mountCurrentRewardGardenArt();
  }
}

function closeAnimalGardenGame() {
  const host = $('animalGardenMount');
  if (host) host.innerHTML = '';
}

function startGamePreview() {
  if (!state.user) {
    showToast('请先登录再体验小游戏', 'info');
    return;
  }
  if (getBankedGameMinutes() <= 0) setBankedGameMinutes(12);
  const mount = $('animalGardenMount') || document.createElement('div');
  mount.id = 'animalGardenMount';
  if (!mount.parentNode) $('pageHome').appendChild(mount);
  mount.innerHTML = renderAnimalGardenGame();
  mountCurrentRewardGardenArt();
}

function renderGameTimePrompt() {
  if (!(state.session.reviewRounds.length > 0)) return '';
  const minutes = getBankedGameMinutes();
  if (minutes <= 0) return '';
  return `
    <div class="game-time-prompt">
      <div class="game-time-window">
        <div class="game-time-title">小游戏时间</div>
        <div class="game-time-bank">存留时间 <strong>${escapeHtml(minutes)}</strong> 分钟</div>
        <div class="game-time-copy">复习已经完成至少一轮，可以现在玩，也可以把时间存到下次一起玩。</div>
        <div class="game-time-actions">
          <button class="btn btn-primary btn-small" onclick="startBankedGameNow()">现在玩</button>
          <button class="btn btn-secondary btn-small" onclick="keepBankedGameForLater()">下次玩</button>
        </div>
      </div>
    </div>
  `;
}

function startBankedGameNow() {
  if (getBankedGameMinutes() <= 0) {
    showToast('暂无可用小游戏时间', 'info');
    return;
  }
  const host = $('animalGardenMount') || document.createElement('div');
  host.id = 'animalGardenMount';
  if (!host.parentNode) $('pageHome')?.appendChild(host);
  host.innerHTML = renderAnimalGardenGame();
  mountCurrentRewardGardenArt();
}

function keepBankedGameForLater() {
  showToast('小游戏时间已存留：' + getBankedGameMinutes() + ' 分钟', 'success');
}
function updateAuthMode(mode) {
  state.authMode = mode;
  const isRegister = mode === 'register';

  $('loginTab')?.classList.toggle('active', !isRegister);
  $('registerTab')?.classList.toggle('active', isRegister);
  $('authUsernameWrap').style.display = 'flex';
  $('authPasswordWrap').style.display = 'flex';
  $('authConfirmWrap').style.display = isRegister ? 'flex' : 'none';
  $('authIdentifierLabel').textContent = '用户名';
  authSubmitBtn.textContent = isRegister ? '注册并登录' : '登录';
  authHint.textContent = isRegister
    ? '注册后可在任意浏览器用用户名和密码登录。'
    : '请输入用户名和密码登录。';
}

function setAuthMode(mode) {
  updateAuthMode(mode);
}

function activatePage(page) {
  const target = $('page' + page.charAt(0).toUpperCase() + page.slice(1));
  if (!target) return false;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  target.classList.add('active');
  state.currentPage = page;
  return true;
}

function updateAppHistory(page, { replace = false } = {}) {
  if (!window.history) return;
  const entry = { wordbotPage: page };
  if (replace || !state.historyInitialized) {
    history.replaceState(entry, '', window.location.href);
  } else {
    history.pushState(entry, '', window.location.href);
  }
  state.historyInitialized = true;
}

function showLoginPage(options = {}) {
  if (activatePage('login')) updateAppHistory('login', { replace: options.replace !== false });
}

function showAppPage(options = {}) {
  if (activatePage('home')) updateAppHistory('home', { replace: options.replace !== false });
}

function applyEnvironmentControls() {
  const modeWrap = $('modeSelectorWrap');
  const historyWrap = $('historyModeSelectorWrap');
  const gamePreviewBtn = $('gamePreviewBtn');
  if (modeWrap) modeWrap.style.display = URL_PARAMS.get('dev') === '1' ? 'block' : 'none';
  if (historyWrap) historyWrap.style.display = DEV_MODE ? 'flex' : 'none';
  if (gamePreviewBtn) gamePreviewBtn.style.display = 'none';
  if (!DEV_MODE && state.mode === 'test') state.mode = 'real';
  if (!DEV_MODE && state.historyMode === 'test') state.historyMode = 'real';
  const realModeBtn = document.querySelector('.mode-btn[data-mode="real"]');
  if (realModeBtn && !state.user) {
    realModeBtn.classList.add('level-active');
  }
  document.querySelectorAll('.mode-btn, .history-mode-btn').forEach(button => {
    if (button.dataset.mode === 'test' && !DEV_MODE) {
      button.style.display = 'none';
    } else {
      button.style.display = '';
    }
  });
}

function formatDate(ts) {
  if (!ts) return '暂无';
  const d = new Date(Number(ts));
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function api(path, opts = {}) {
  const timeoutMs = opts.timeoutMs || 45000;
  const { timeoutMs: _timeoutMs, signal, ...fetchOptions } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...fetchOptions,
      signal: signal || controller.signal
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      const error = new Error(data.error || ('请求失败（HTTP ' + response.status + '）'));
      error.code = data.code || 'HTTP_ERROR';
      error.source = data.source;
      error.diagnostics = data.diagnostics;
      error.payload = data;
      error.duplicateWords = data.duplicateWords;
      error.missingWords = data.missingWords;
      throw error;
    }
    return data;
  } catch (error) {
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeApiError(error) {
  if (error?.name === 'AbortError') {
    return new Error('请求超时，请稍后重试；如果后端刚部署，Render 可能正在冷启动。');
  }
  return error;
}
function formatParentLoginError(error) {
  const message = normalizeApiError(error).message || '';
  if (/parent username\/password error/i.test(message)) {
    return `当前孩子 ${state.user || ''} 绑定的家长用户名或密码不对，请确认用的是这个孩子账号下设置的家长密码。`;
  }
  return message;
}

function navigateTo(page, options = {}) {
  if (!state.user && page !== 'login') {
    showLoginPage({ replace: true });
    return;
  }
  if (!activatePage(page)) return;
  if (!options.skipHistory) updateAppHistory(page, { replace: Boolean(options.replace) });
  if (page === 'home') loadHome();
  if (page === 'history') loadHistory();
}
function hasInProgressSession() {
  return state.currentPage === 'quiz' && Boolean(state.quiz?.questions?.length && !state.quiz.result);
}

function handleInAppBack() {
  if (hasInProgressSession()) {
    saveCurrentSessionProgress();
    navigateTo('home', { replace: true });
    showToast('\u5df2\u4fdd\u5b58\u8fdb\u5ea6\uff0c\u53ef\u4ece\u9996\u9875\u7ee7\u7eed', 'info');
    return true;
  }
  if (['parent', 'history', 'results'].includes(state.currentPage)) {
    navigateTo('home', { replace: true });
    return true;
  }
  return false;
}

function handleBrowserBack() {
  const handled = handleInAppBack();
  if (!handled && state.currentPage === 'home') {
    updateAppHistory('home', { replace: true });
  }
}

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function handleGlobalKeydown(event) {
  if (event.key === 'Backspace' && !isEditableTarget(event.target)) {
    event.preventDefault();
    handleInAppBack();
  }
}

function initializeAppHistory() {
  if (state.historyInitialized) return;
  history.replaceState({ wordbotPage: state.currentPage }, '', window.location.href);
  state.historyInitialized = true;
  window.addEventListener('popstate', handleBrowserBack);
  window.addEventListener('keydown', handleGlobalKeydown);
}

// ========== Auth ==========
function normalizeUsername(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function handleUnregisteredPasswordLogin(error) {
  const message = normalizeApiError(error).message;
  const isUnregisteredPassword = message.includes('尚未注册密码') || message.includes('user has no password yet');
  if (state.authMode !== 'login' || !isUnregisteredPassword) return false;
  updateAuthMode('register');
  authPasswordConfirm.value = authPassword.value;
  authHint.textContent = '这个账号还没有绑定服务端密码。首次使用请再点一次注册并登录，之后任何浏览器都可以直接登录。';
  showToast('首次使用请再点一次注册并登录，完成密码绑定', 'info');
  return true;
}

async function submitAuth() {
  const username = normalizeUsername(authUsername.value);
  const password = authPassword.value;
  const confirm = authPasswordConfirm.value;

  if (state.authMode === 'register') {
    if (!username) { showToast('请输入用户名', 'error'); return; }
    if (/^\d{11}$/.test(username)) { showToast('用户名不能是手机号', 'error'); return; }
    if (!password || password.length < 4) { showToast('密码至少需要 4 位', 'error'); return; }
    if (password !== confirm) { showToast('两次输入的密码不一致', 'error'); return; }
  } else {
    if (!username) { showToast('请输入用户名', 'error'); return; }
    if (!password || password.length < 4) { showToast('密码至少需要 4 位', 'error'); return; }
  }

  const isRegister = state.authMode === 'register';
  const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
  const body = isRegister
    ? { username, password }
    : { identifier: username, password };

  showLoading(isRegister ? '正在注册...' : '正在登录...');
  try {
    const data = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    loginAs(data.user || username);
    showToast(isRegister ? '注册成功，已登录' : '登录成功', 'success');
  } catch (error) {
    if (!handleUnregisteredPasswordLogin(error)) {
      const message = normalizeApiError(error).message;
      showToast((isRegister ? '注册失败: ' : '登录失败: ') + message, 'error');
    }
  } finally {
    hideLoading();
  }
}

function loginAs(user) {
  state.user = user;
  state.users = [user];
  state.level = loadUserDifficulty(user);
  state.learningSettings = null;
  state.parentAccess = false;
  state.parentAuth = null;
  state.mode = 'real';
  state.historyMode = 'real';
  setSessionUser(user);
  showAppPage();
  applyEnvironmentControls();
  renderUsers(state.users);
  updateLevelButtons();
  syncLearningSettingsFromServer(user).finally(() => loadHome());
}

function logout() {
  clearQuizDraft();
  clearSessionUser();
  state.user = null;
  state.quiz = null;
  state.answers = [];
  state.confidences = [];
  state.parentAccess = false;
  state.parentAuth = null;
  resetParentConsole();
  showLoginPage();
  showToast('已退出登录', 'info');
}

// ========== User ==========
function renderUsers(users) {
  const el = $('userList');
  el.replaceChildren();
  const currentUser = state.user || users[0];
  if (!currentUser) {
    const empty = document.createElement('div');
    empty.className = 'current-user-empty';
    empty.textContent = '尚未登录';
    el.appendChild(empty);
    return;
  }
  const card = document.createElement('div');
  card.className = 'current-user-card';
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = currentUser.charAt(0).toUpperCase();
  const text = document.createElement('div');
  text.className = 'current-user-text';
  const label = document.createElement('span');
  label.className = 'current-user-label';
  label.textContent = '当前用户：';
  const name = document.createElement('strong');
  name.textContent = currentUser;
  const mode = document.createElement('small');
  mode.textContent = URL_PARAMS.get('dev') === '1' ? '开发预览模式' : '正式学习模式';
  const title = document.createElement('div');
  title.className = 'current-user-title';
  title.append(label, name);
  text.append(title, mode);
  card.append(avatar, text);
  el.appendChild(card);
}

function selectUser(user) {
  if (!state.user) {
    loginAs(user);
    return;
  }
  state.user = user;
  state.level = loadUserDifficulty(user);
  state.learningSettings = null;
  state.parentAccess = false;
  state.parentAuth = null;
  resetParentConsole();
  updateLevelButtons();
  renderUsers(state.users);
  syncLearningSettingsFromServer(user).finally(() => { renderStudentTools(); loadStats(user); });
  restoreActiveReview(user);
}

function difficultyPreferenceKey(user) {
  return `wordbot:difficulty:${user}`;
}

function loadUserDifficulty(user) {
  return localStorage.getItem(difficultyPreferenceKey(user)) || DEFAULT_LEVEL;
}

function saveUserDifficulty(user, level) {
  if (user && level) localStorage.setItem(difficultyPreferenceKey(user), level);
}

async function syncLearningSettingsFromServer(user, { silent = true } = {}) {
  if (!user || DEMO_MODE) return state.learningSettings;
  try {
    const data = await api(`/api/admin/userSettings?userId=${encodeURIComponent(user)}`);
    const settings = data.settings || null;
    if (settings?.learningLevel) {
      state.learningSettings = settings;
      state.level = settings.learningLevel;
      saveUserDifficulty(user, settings.learningLevel);
      updateLevelButtons();
    }
    return settings;
  } catch (error) {
    if (!silent) showToast('学习设置同步失败: ' + normalizeApiError(error).message, 'error');
    return state.learningSettings;
  }
}

function getLevelCacheStatus(status, level = state.level) {
  return status?.byLevel?.[level] || {};
}

function getLevelCacheReadyCount(status, level = state.level) {
  return Number(getLevelCacheStatus(status, level)?.ready || 0);
}

function isLevelCacheReady(status, level = state.level, requiredCount = 10) {
  if (!status?.configured) return true;
  return getLevelCacheReadyCount(status, level) >= requiredCount;
}

async function requestQuestionCacheRebuild(user) {
  if (DEMO_MODE || !user) return null;
  try {
    return await api('/api/admin/questionCache/rebuild', {
      method: 'POST',
      timeoutMs: 90000,
      body: JSON.stringify({ userId: user })
    });
  } catch (error) {
    console.warn('question cache rebuild trigger failed', error);
    return null;
  }
}

async function ensureLevelCacheReadyForQuiz(user, level) {
  if (DEMO_MODE) return true;
  const data = await api(`/api/admin/questionCache/status?userId=${encodeURIComponent(user)}`);
  const status = data.status || {};
  const requiredCount = 10;
  if (isLevelCacheReady(status, level, requiredCount)) return true;
  const readyCount = getLevelCacheReadyCount(status, level);
  requestQuestionCacheRebuild(user);
  showToast(`${formatLearningLevel(level)}\u9898\u5e93\u6b63\u5728\u81ea\u52a8\u51c6\u5907\u4e2d\uff08${readyCount}/${requiredCount}\uff09\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5`, 'info');
  return false;
}

function activeQuizKey(user) {
  return `wordbot:active-quiz:${user}`;
}

function hasActiveQuizDraft(user) {
  if (!user) return false;
  try {
    const saved = JSON.parse(localStorage.getItem(activeQuizKey(user)) || 'null');
    return Boolean(saved?.quiz?.questions?.length && !saved.quiz.result);
  } catch {
    return false;
  }
}

function saveQuizDraft() {
  if (!state.user || state.session.kind !== 'quiz' || !state.quiz?.questions?.length || state.quiz.result) return;
  localStorage.setItem(activeQuizKey(state.user), JSON.stringify({
    session: state.session,
    quiz: state.quiz,
    currentQuestion: state.currentQuestion,
    answers: state.answers,
    confidences: state.confidences,
    savedAt: Date.now(),
  }));
  renderStudentTools();
}

function clearQuizDraft() {
  if (state.user) localStorage.removeItem(activeQuizKey(state.user));
  renderStudentTools();
}

function restoreQuizDraft(user = state.user) {
  const raw = localStorage.getItem(activeQuizKey(user));
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    if (!saved?.quiz?.questions?.length || saved.quiz.result) return false;
    state.session = saved.session || { kind: 'quiz' };
    state.quiz = saved.quiz;
    state.currentQuestion = saved.currentQuestion || 0;
    state.answers = saved.answers || new Array(saved.quiz.questions.length).fill(null);
    state.confidences = saved.confidences || new Array(saved.quiz.questions.length).fill(null);
    navigateTo('quiz');
    renderQuestion(state.currentQuestion);
    return true;
  } catch {
    localStorage.removeItem(activeQuizKey(user));
    return false;
  }
}

function saveCurrentSessionProgress() {
  saveActiveReview();
  saveQuizDraft();
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
  const currentLevelText = $('currentLevelText');
  if (currentLevelText) currentLevelText.textContent = formatLearningLevel(state.level || DEFAULT_LEVEL);
  document.querySelectorAll('.level-btn[data-level]').forEach(button => {
    button.classList.toggle('level-active', button.dataset.level === state.level);
  });
}

function ensureHomeV2Hero() {
  const hero = document.querySelector('#pageHome .dragon-hero-card');
  if (!hero) return;
  hero.classList.add('home-v2-hero-card');

  const content = hero.querySelector('.dragon-hero-content');
  if (content) {
    content.classList.add('home-v2-hero-copy');
    const titleWrap = content.querySelector('.dragon-hero-title-wrap');
    if (titleWrap) {
      titleWrap.innerHTML = '<h2>和小龙一起学单词</h2><p class="home-v2-hero-note">把新词慢慢变成朋友</p>';
    }
  }

  const chips = hero.querySelector('.dragon-hero-chips');
  if (chips) {
    chips.classList.add('home-v2-hero-chips');
    const parentChip = chips.querySelector('.hero-chip-parent');
    if (parentChip) parentChip.classList.add('home-v2-parent-chip');
  }

  const dragon = hero.querySelector('.home-dragon');
  if (dragon) {
    dragon.src = 'assets/xiaolong-transparent.png';
    dragon.removeAttribute('data-legacy-src');
  }

  const scene = hero.querySelector('.dragon-scene');
  if (scene && !scene.querySelector('.home-v2-mountain')) {
    scene.insertAdjacentHTML('afterbegin', [
      '<span class="home-v2-cloud home-v2-cloud-one"></span>',
      '<span class="home-v2-cloud home-v2-cloud-two"></span>',
      '<span class="home-v2-mountain"></span>',
      '<span class="home-v2-water"></span>',
      '<span class="home-v2-grass home-v2-grass-one"></span>',
      '<span class="home-v2-grass home-v2-grass-two"></span>',
      '<span class="home-v2-grass home-v2-grass-three"></span>'
    ].join(''));
  }
}
// ========== Home ==========
async function loadHome() {
  ensureHomeV2Hero();
  if (!state.user) {
    showLoginPage();
    return;
  }
  showLoading('加载用户数据...');
  try {
    if (DEMO_MODE) {
      state.users = [state.user];
      renderUsers(state.users);
      renderStudentTools();
      await loadStats(state.user);
      showToast('当前为演示模式，数据不会写入服务器', 'info');
      hideLoading();
      return;
    }
    state.users = [state.user];
    renderUsers(state.users);
    renderStudentTools();
    await loadStats(state.user);
  } catch(e) {
    showToast('加载用户失败: ' + e.message, 'error');
    $('statsContent').innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text-secondary);font-size:15px;">后端连接异常，当前仅可查看登录后的本地预览</div>';
  }
  hideLoading();
}

// 清理测试数据确认
function showCleanupConfirm() {
  const user = state.user;
  if (!user) { showToast('请先选择用户', 'warn'); return; }
  if (!confirm('确定删除用户 "' + user + '" 的全部测试模式答题记录吗？\n\n正式学习记录不会被删除。')) return;
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
      showToast('已删除 ' + res.deleted + ' 条测试记录', 'success');
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

function selectMode(el, mode) {
  if (!DEV_MODE && mode === 'test') return;
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach(button => {
    button.classList.toggle('level-active', button.dataset.mode === mode);
  });
  $('modeHint').textContent = mode === 'test'
    ? '测试模式只保存答题记录，不改变掌握状态和正式统计'
    : '正式学习会更新掌握状态和统计';
}

function selectHistoryMode(el, mode) {
  if (!DEV_MODE && mode === 'test') return;
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

function handleContinueQuizEntry() {
  if (restoreQuizDraft()) return true;
  showToast('暂无未完成考核', 'info');
  renderStudentTools();
  return false;
}

function renderStudentTools() {
  if (!state.user) return;
  let section = $('studentTools');
  if (!section) {
    section = document.createElement('section');
    section.id = 'studentTools';
    section.className = 'home-v2-quick-card student-tools';
    const stats = $('statsContent');
    stats?.insertAdjacentElement('afterend', section);
  }
  section.className = 'home-v2-quick-card student-tools';
  const hasDraft = hasActiveQuizDraft(state.user);
  const bankedMinutes = getBankedGameMinutes(state.user);
  section.innerHTML = [
    '<div class="home-v2-quick-grid">',
    '<button class="home-v2-quick-item home-v2-quick-continue" type="button" onclick="handleContinueQuizEntry()" aria-disabled="' + (!hasDraft) + '"><span class="home-v2-quick-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m8 5 10 7-10 7z"/></svg></span><span class="home-v2-quick-text"><strong>继续上次练习</strong><small>' + (hasDraft ? '回到未完成练习' : '暂无未完成练习') + '</small></span></button>',
    '<button class="home-v2-quick-item home-v2-quick-bank" type="button" onclick="startBankedGameNow()"><span class="home-v2-quick-icon green" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8h8v8H8z"/><path d="M9 4h6"/><path d="M9 20h6"/></svg></span><span class="home-v2-quick-text"><strong>已存游戏时间</strong><small>' + escapeHtml(bankedMinutes) + ' 分钟</small></span></button>',
    '<button class="home-v2-quick-item home-v2-quick-add" type="button" onclick="openStudentWordEntry()"><span class="home-v2-quick-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg></span><span class="home-v2-quick-text"><strong>录入单词</strong><small>添加新词</small></span></button>',
    '<button class="home-v2-quick-item home-v2-quick-history" type="button" onclick="navigateTo(\'history\')"><span class="home-v2-quick-icon blue" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.5v4.8l3.1 1.7"/></svg></span><span class="home-v2-quick-text"><strong>考核历史</strong><small>查看记录</small></span></button>',
    '</div>',
    '<div class="parent-tool-panel student-tool-panel" id="studentToolPanel" style="display:none;"></div>'
  ].join('');
}
function openStudentWordEntry() {
  const panel = $('studentToolPanel');
  if (!panel) return;
  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="parent-panel-head">
      <strong>录入单词</strong>
      <button type="button" onclick="closeStudentTool()" aria-label="关闭">×</button>
    </div>
    <label class="parent-field">
      <span>批量单词</span>
      <textarea id="studentWordsInput" rows="6" placeholder="可以用换行、逗号或分号分隔，例如&#10;resilient, genuine&#10;promotion | 促销活动"></textarea>
    </label>
    <div class="parent-help">会加入 ${escapeHtml(state.user)} 的词库；释义、例句和检查由后端生成。</div>
    <div id="studentWordEntryDuplicatePanel" class="wordEntryDuplicatePanel"></div>
    <button class="btn btn-primary btn-small" type="button" onclick="submitParentWords()">提交录入</button>
  `;
}

function closeStudentTool() {
  const panel = $('studentToolPanel');
  if (!panel) return;
  panel.style.display = 'none';
  panel.innerHTML = '';
}

function ensureParentPage() {
  if ($('pageParent')) return;
  const page = document.createElement('div');
  page.className = 'page';
  page.id = 'pageParent';
  page.innerHTML = `
    <div class="header">
      <div class="header-title">
        <div class="logo">⚙</div>
        家长控制台
      </div>
      <div class="header-actions">
        <button class="header-btn" onclick="navigateTo('home')" title="返回首页">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/><path d="M20 12H9"/></svg>
        </button>
      </div>
    </div>
    <section class="parent-console parent-console-page" aria-label="家长控制台">
      <div id="parentPageMount"></div>
    </section>
  `;
  $('app')?.appendChild(page);
  const mount = $('parentPageMount');
  for (const id of ['parentGatePanel', 'parentToolGrid', 'parentToolPanel']) {
    const node = $(id);
    if (node && mount) mount.appendChild(node);
  }
  const grid = $('parentToolGrid');
  if (grid) {
    grid.innerHTML = `
      <button class="parent-tool-card" type="button" onclick="openParentTool('queryWord')">
        <span class="parent-tool-icon">⌕</span>
        <span>查询单词</span>
        <small>查看单词状态</small>
      </button>
      <button class="parent-tool-card" type="button" onclick="openParentTool('editWords')">
        <span class="parent-tool-icon">✎</span>
        <span>编辑词库</span>
        <small>分页管理状态</small>
      </button>
      <button class="parent-tool-card" type="button" onclick="openParentTool('learningSettings')">
        <span class="parent-tool-icon">⚙</span>
        <span>学习设置</span>
        <small>难度与缓存</small>
      </button>
      <button class="parent-tool-card" type="button" onclick="openParentTool('resetChildPassword')">
        <span class="parent-tool-icon">钥</span>
        <span>重置孩子密码</span>
        <small>为当前孩子设置新密码</small>
      </button>
    `;
  }

}
function getParentToolPanel() {
  return $('parentToolPanel');
}

function resetParentConsole() {
  const gate = $('parentGatePanel');
  const grid = $('parentToolGrid');
  const panel = $('parentToolPanel');
  if (gate) gate.style.display = 'none';
  if (grid) grid.style.display = 'none';
  if (panel) {
    panel.style.display = 'none';
    panel.innerHTML = '';
  }
}

function showParentTools() {
  const gate = $('parentGatePanel');
  const grid = $('parentToolGrid');
  if (gate) gate.style.display = 'none';
  if (grid) grid.style.display = 'grid';
}

function openParentConsole() {
  if (!state.user) {
    showToast('请先登录用户', 'error');
    return;
  }
  ensureParentPage();
  navigateTo('parent');
  if (state.parentAccess) {
    showParentTools();
    return;
  }
  const gate = $('parentGatePanel');
  const grid = $('parentToolGrid');
  if (grid) grid.style.display = 'none';
  if (gate) gate.style.display = 'block';
}

function closeParentConsole() {
  resetParentConsole();
  navigateTo('home');
}

function ensureParentAccess() {
  if (state.parentAccess) return true;
  openParentConsole();
  showToast('请先完成家长手机号和密码验证', 'info');
  return false;
}

async function verifyParentPassword() {
  const parentUsername = normalizeUsername($('parentUsernameInput')?.value);
  const password = $('parentPasswordInput')?.value || '';
  if (!parentUsername || !password) {
    showToast('请输入家长用户名和密码', 'error');
    return;
  }
  showLoading('正在验证...');
  try {
    const data = DEMO_MODE
      ? { user: state.user }
      : await api('/api/auth/parent/login', {
          method: 'POST',
          body: JSON.stringify({ user: state.user, parentUsername, password })
        });
    if (normalizeUsername(data.user) !== normalizeUsername(state.user)) {
      throw new Error('家长账号不属于当前孩子');
    }
    state.parentAccess = true;
    state.parentAuth = { parentUsername, password };
    showParentTools();
    showToast('已进入家长控制台', 'success');
  } catch (error) {
    showToast('验证失败: ' + formatParentLoginError(error), 'error');
  } finally {
    hideLoading();
  }
}
function openParentTool(tool) {
  if (!state.user) {
    showToast('请先登录用户', 'error');
    return;
  }
  if (!ensureParentAccess()) return;
  const panel = getParentToolPanel();
  if (!panel) return;
  panel.style.display = 'block';

  if (tool === 'addWords') {
    panel.innerHTML = `
      <div class="parent-panel-head">
        <strong>录入单词</strong>
        <button type="button" onclick="closeParentTool()" aria-label="关闭">×</button>
      </div>
      <label class="parent-field">
        <span>批量单词</span>
        <textarea id="parentWordsInput" rows="6" placeholder="一行一个英文单词；新义项可写 word | 中文释义，例如&#10;resilient&#10;promotion | 促销活动"></textarea>
      </label>
      <div class="parent-help">当前会把单词加入 ${escapeHtml(state.user)} 的词库；英文释义、中文释义、例句和干扰项由后端生成。</div>
      <div id="parentWordEntryDuplicatePanel" class="wordEntryDuplicatePanel"></div>
    <button class="btn btn-primary btn-small" type="button" onclick="submitParentWords()">提交录入</button>
    `;
    return;
  }

  if (tool === 'queryWord') {
    panel.innerHTML = `
      <div class="parent-panel-head">
        <strong>查询单词</strong>
        <button type="button" onclick="closeParentTool()" aria-label="关闭">×</button>
      </div>
      <div class="parent-inline-form">
        <input id="parentSearchWordInput" type="text" placeholder="输入英文单词" onkeydown="if(event.key==='Enter')searchParentWord()" />
        <button class="btn btn-secondary btn-small" type="button" onclick="searchParentWord()">查询</button>
      </div>
      <div id="parentWordResult" class="parent-result-empty">输入一个单词，只查看它在当前孩子词库里的状态。</div>
    `;
    return;
  }

  if (tool === 'editWords') {
    panel.innerHTML = `
      <div class="parent-panel-head">
        <strong>编辑词库</strong>
        <button type="button" onclick="closeParentTool()" aria-label="关闭">×</button>
      </div>
      <div class="parent-help">单词管理 → 单词列表 → 点击单词进入编辑。</div>
      <label class="parent-field parent-word-filter">
        <span>按状态筛选</span>
        <select id="parentWordStatusFilter" onchange="loadParentWordLibrary(1)">
          <option value="">全部状态</option>
          ${STATUS_OPTIONS.map(status => `<option value="${status}">${STATUS_LABELS[status]}</option>`).join('')}
        </select>
      </label>
      <div id="parentWordLibrary" class="parent-result-empty">正在加载词库...</div>
      <div id="parentWordEditor" class="parent-word-editor"></div>
    `;
    loadParentWordLibrary(1);
    return;
  }
  if (tool === 'learningSettings') {
    panel.innerHTML = `
      <div class="parent-panel-head">
        <strong>学习设置</strong>
        <button type="button" onclick="closeParentTool()" aria-label="关闭">×</button>
      </div>
      <div id="parentSettingsContent" class="parent-result-empty">正在加载学习设置...</div>
    `;
    loadParentLearningSettings();
    return;
  }

  if (tool === 'resetChildPassword') {
    panel.innerHTML = `
      <div class="parent-panel-head">
        <strong>重置孩子密码</strong>
        <button type="button" onclick="closeParentTool()" aria-label="关闭">×</button>
      </div>
      <label class="parent-field">
        <span>新密码</span>
        <input id="parentResetChildPassword" type="password" autocomplete="new-password" placeholder="至少 4 位" />
      </label>
      <label class="parent-field">
        <span>再次输入</span>
        <input id="parentResetChildPasswordConfirm" type="password" autocomplete="new-password" placeholder="再输一次新密码" onkeydown="if(event.key==='Enter')resetChildPassword()" />
      </label>
      <div class="parent-help">只会重置当前孩子 ${escapeHtml(state.user)} 的登录密码；家长身份会由后端再次校验。</div>
      <button class="btn btn-primary btn-small" type="button" onclick="resetChildPassword()">确认重置</button>
    `;
  }
}

async function resetChildPassword() {
  if (!state.user) {
    showToast('请先登录用户', 'error');
    return;
  }
  if (!state.parentAuth?.parentUsername || !state.parentAuth?.password) {
    state.parentAccess = false;
    state.parentAuth = null;
    openParentConsole();
    showToast('请先重新完成家长验证', 'info');
    return;
  }
  const newPassword = $('parentResetChildPassword')?.value || '';
  const confirmPassword = $('parentResetChildPasswordConfirm')?.value || '';
  if (newPassword.length < 4) {
    showToast('新密码至少需要 4 位', 'error');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('两次输入的新密码不一致', 'error');
    return;
  }
  showLoading('正在重置孩子密码...');
  try {
    if (!DEMO_MODE) {
      await api('/api/auth/parent/reset-child-password', {
        method: 'POST',
        body: JSON.stringify({
          user: state.user,
          parentUsername: state.parentAuth.parentUsername,
          parentPassword: state.parentAuth.password,
          newPassword,
        })
      });
    }
    $('parentResetChildPassword').value = '';
    $('parentResetChildPasswordConfirm').value = '';
    showToast('孩子密码已重置', 'success');
  } catch (error) {
    showToast('重置失败: ' + normalizeApiError(error).message, 'error');
  } finally {
    hideLoading();
  }
}

function closeParentTool() {
  const panel = getParentToolPanel();
  if (!panel) return;
  panel.style.display = 'none';
  panel.innerHTML = '';
}

function parseParentWordEntries(value) {
  const raw = String(value || '');
  return Array.from(new Map(raw
    .split(/\n+/)
    .flatMap(line => line.includes('|') ? [line] : line.split(/[,，;；\s]+/))
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [wordPart, ...meaningParts] = item.split('|');
      const word = String(wordPart || '').trim().toLowerCase();
      const cnMeaning = meaningParts.join('|').trim();
      return { word, cnMeaning };
    })
    .filter(entry => entry.word)
    .map(entry => [`${entry.word}|${entry.cnMeaning}`, entry])
  ).values());
}

function parseParentWordsInput(value) {
  return parseParentWordEntries(value).map(entry => entry.word);
}

function getWordEntryDuplicatePanel() {
  return $('parentWordsInput') ? $('parentWordEntryDuplicatePanel') : $('studentWordEntryDuplicatePanel');
}

function renderDuplicateWordConfirmation(duplicateWords = []) {
  const panel = getWordEntryDuplicatePanel();
  if (!panel) return;
  const rows = duplicateWords.map(item => {
    const existing = (item.existing || []).map(record => {
      const meaning = record.cnMeaning || record.meaning || '暂无释义';
      return `<li>${escapeHtml(meaning)}</li>`;
    }).join('');
    return `<div class="duplicate-word-card"><strong>${escapeHtml(item.word)}</strong><ul>${existing}</ul></div>`;
  }).join('');
  panel.innerHTML = `
    <div class="duplicate-word-confirm">
      <div class="parent-help">这些单词已经在词库里。若是新义项，请在输入框里写成 <strong>promotion | 促销活动</strong> 后再确认新增。</div>
      ${rows}
      <div class="parent-inline-form">
        <button class="btn btn-secondary btn-small" type="button" onclick="submitParentWords({ skipDuplicateWords: true })">跳过重复，只添加新词</button>
        <button class="btn btn-primary btn-small" type="button" onclick="submitParentWords({ confirmNewMeanings: true })">作为新义项添加</button>
      </div>
    </div>
  `;
}

function clearDuplicateWordConfirmation() {
  const panel = getWordEntryDuplicatePanel();
  if (panel) panel.innerHTML = '';
}

async function submitParentWords(options = {}) {
  const input = $('parentWordsInput') || $('studentWordsInput');
  const entries = parseParentWordEntries(input?.value);
  if (!entries.length) {
    showToast('请先输入至少一个单词', 'warn');
    return;
  }
  if (options.confirmNewMeanings) {
    const validation = await api('/api/admin/validateWords', {
      method: 'POST',
      body: JSON.stringify({ targetUser: state.user, words: entries })
    });
    const duplicateWordSet = new Set((validation.duplicateWords || []).map(item => item.word));
    const missingMeaning = entries.filter(entry => duplicateWordSet.has(entry.word) && !entry.cnMeaning);
    if (missingMeaning.length) {
      showToast('新增义项请写成 promotion | 促销活动 这种格式', 'warn');
      renderDuplicateWordConfirmation(validation.duplicateWords || []);
      return;
    }
  }
  showLoading('正在录入单词...');
  try {
    const result = DEMO_MODE
      ? { success: true, count: entries.length }
      : await api('/api/admin/addWords', {
          method: 'POST',
          timeoutMs: 90000,
          body: JSON.stringify({
            targetUser: state.user,
            words: entries,
            confirmNewMeanings: Boolean(options.confirmNewMeanings),
            skipDuplicateWords: Boolean(options.skipDuplicateWords),
          })
        });
    const skipped = result.skippedDuplicateWords?.length ? `，跳过重复 ${result.skippedDuplicateWords.length} 个` : '';
    showToast('已提交 ' + (result.count ?? entries.length) + ' 个单词' + skipped, 'success');
    if (input) input.value = '';
    clearDuplicateWordConfirmation();
    loadStats(state.user);
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (normalized.code === 'DUPLICATE_WORD_CONFIRMATION_REQUIRED') {
      renderDuplicateWordConfirmation(normalized.duplicateWords || normalized.payload?.duplicateWords || []);
      showToast('发现重复单词，请确认是否作为新义项添加', 'info');
    } else if (normalized.code === 'NEW_MEANING_REQUIRES_MEANING') {
      showToast('新增义项需要填写中文释义，例如 promotion | 促销活动', 'warn');
    } else {
      showToast('录入失败: ' + normalized.message, 'error');
    }
  } finally {
    hideLoading();
  }
}

async function searchParentWord() {
  const word = $('parentSearchWordInput')?.value.trim();
  const resultEl = $('parentWordResult');
  if (!word) {
    showToast('请输入要查询的单词', 'warn');
    return;
  }
  if (!resultEl) return;
  resultEl.textContent = '正在查询...';
  try {
    const data = DEMO_MODE
      ? { exists: true, word, meaning: 'demo meaning', cnMeaning: '演示释义', pos: 'n.', context: `A demo sentence uses ${word}.`, status: 'Pending' }
      : await api(`/api/word?userId=${encodeURIComponent(state.user)}&word=${encodeURIComponent(word)}`);
    if (!data || data.exists === false) {
      resultEl.innerHTML = `<div class="parent-result-empty">没有找到 ${escapeHtml(word)}，可以先在“录入单词”里添加。</div>`;
      return;
    }
    const cnMeaning = data.cnMeaning || data.CN_Meaning || '暂无中文释义';
    const meaning = data.meaning || data.Meaning || '暂无英文释义';
    const pos = data.pos || data.POS || '';
    const context = data.context || data.Context || '';
    resultEl.innerHTML = `
      <div class="parent-word-query-card">
        <div class="parent-word-query-head">
          <strong>${escapeHtml(data.word || word)}</strong>
          <span class="parent-word-status">${escapeHtml(formatWordStatus(data.status || data.Status || 'Pending'))}</span>
        </div>
        <dl class="parent-word-detail-list">
          <div><dt>中文释义</dt><dd>${escapeHtml(cnMeaning)}</dd></div>
          <div><dt>英文释义</dt><dd>${escapeHtml(meaning)}</dd></div>
          ${pos ? `<div><dt>词性</dt><dd>${escapeHtml(pos)}</dd></div>` : ''}
          ${context ? `<div><dt>例句</dt><dd>${escapeHtml(context)}</dd></div>` : ''}
        </dl>
      </div>
    `;
  } catch (error) {
    resultEl.innerHTML = `<div class="parent-result-empty">查询失败：${escapeHtml(normalizeApiError(error).message)}</div>`;
  }
}

function parentWordDomId(recordId) {
  return String(recordId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getParentWordStatusFilter() {
  const status = $('parentWordStatusFilter')?.value || '';
  return STATUS_OPTIONS.includes(status) ? status : '';
}

function parentWordStatusOptions(currentStatus) {
  const selectedStatus = STATUS_OPTIONS.includes(currentStatus) ? currentStatus : 'Pending';
  return STATUS_OPTIONS.map(status => `<option value="${status}" ${status === selectedStatus ? 'selected' : ''}>${escapeHtml(STATUS_LABELS[status])}</option>`).join('');
}

async function loadParentWordLibrary(page = 1) {
  const libraryEl = $('parentWordLibrary');
  if (!libraryEl) return;
  libraryEl.textContent = '正在加载词库...';
  const statusFilter = getParentWordStatusFilter();
  try {
    const pageSize = 20;
    const data = DEMO_MODE
      ? (() => {
          const allWords = DEMO_WORDS.map((item, index) => ({
            recordId: `demo-${index}`,
            word: item.word,
            cnMeaning: item.cn,
            meaning: item.meaning,
            pos: item.pos,
            context: item.context,
            status: index % 4 === 0 ? 'Mastered' : index % 4 === 1 ? 'Recognized' : index % 4 === 2 ? 'Consolidating' : 'Pending',
          }));
          const words = statusFilter ? allWords.filter(item => item.status === statusFilter) : allWords;
          const total = words.length;
          const totalPages = Math.max(1, Math.ceil(total / pageSize));
          const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
          const start = (safePage - 1) * pageSize;
          return { words: words.slice(start, start + pageSize), page: safePage, pageSize, total, totalPages };
        })()
      : await api(`/api/admin/words?userId=${encodeURIComponent(state.user)}&page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ''}`);
    renderParentWordLibrary(data);
  } catch (error) {
    libraryEl.innerHTML = `<div class="parent-result-empty">加载词库失败：${escapeHtml(normalizeApiError(error).message)}</div>`;
    const editorEl = $('parentWordEditor');
    if (editorEl) editorEl.innerHTML = '';
  }
}
function renderParentWordLibrary(data) {
  const libraryEl = $('parentWordLibrary');
  if (!libraryEl) return;
  const words = Array.isArray(data?.words) ? data.words : [];
  const page = Number(data?.page || 1);
  const totalPages = Number(data?.totalPages || 1);
  const total = Number(data?.total || words.length);
  parentWordLibraryState.page = page;
  parentWordLibraryState.pageSize = Number(data?.pageSize || 20);
  parentWordLibraryState.total = total;
  parentWordLibraryState.totalPages = totalPages;
  parentWordLibraryState.words = words;
  const editorEl = $('parentWordEditor');
  if (editorEl) editorEl.innerHTML = '';
  if (!words.length) {
    libraryEl.innerHTML = '<div class="parent-result-empty">当前筛选条件下没有单词。</div>';
    return;
  }
  const rows = words.map(item => {
    const recordId = item.recordId || item.id || item.record_id || '';
    const currentStatus = item.status || item.Status || 'Pending';
    const word = item.word || item.Word || '';
    return `
      <div class="parent-word-list-item">
        <button class="parent-word-list-main" type="button" onclick="openParentWordEditor('${escapeHtml(recordId)}', ${page})">
          <div class="parent-word-main">
            <strong>${escapeHtml(word)}</strong>
            <small>${escapeHtml(item.cnMeaning || item.CN_Meaning || item.meaning || item.Meaning || '暂无释义')}</small>
          </div>
        </button>
        <select class="parent-word-status-select" aria-label="修改 ${escapeHtml(word)} 状态" data-record-id="${escapeHtml(recordId)}" data-previous-status="${escapeHtml(currentStatus)}" onchange="saveParentWordStatusFromList(this)">
          ${parentWordStatusOptions(currentStatus)}
        </select>
      </div>
    `;
  }).join('');
  libraryEl.innerHTML = `
    <div class="parent-word-library">
      <div class="parent-word-library-head">
        <strong>共 ${escapeHtml(total)} 个单词</strong>
        <span>第 ${escapeHtml(page)} / ${escapeHtml(totalPages)} 页</span>
      </div>
      ${rows}
      <div class="parent-word-pager">
        <button class="btn btn-secondary btn-small" type="button" onclick="loadParentWordLibrary(${page - 1})" ${page <= 1 ? 'disabled' : ''}>上一页</button>
        <button class="btn btn-secondary btn-small" type="button" onclick="loadParentWordLibrary(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `;
}


async function saveParentWordStatusFromList(selectEl) {
  const recordId = selectEl?.dataset?.recordId || '';
  const status = STATUS_OPTIONS.includes(selectEl?.value) ? selectEl.value : '';
  if (!recordId || !status) return;
  const previousStatus = STATUS_OPTIONS.includes(selectEl?.dataset?.previousStatus) ? selectEl.dataset.previousStatus : '';
  selectEl.disabled = true;
  try {
    if (!DEMO_MODE) {
      await api('/api/word', {
        method: 'PUT',
        body: JSON.stringify({ userId: state.user, recordId, status })
      });
    }
    const item = parentWordLibraryState.words.find(wordItem => {
      const itemRecordId = wordItem.recordId || wordItem.id || wordItem.record_id || '';
      return itemRecordId === recordId;
    });
    if (item) {
      item.status = status;
      item.Status = status;
    }
    selectEl.dataset.previousStatus = status;
    showToast(`状态已更新为${formatWordStatus(status)}`, 'success');
    const activeFilter = getParentWordStatusFilter();
    if (activeFilter && activeFilter !== status) {
      await loadParentWordLibrary(parentWordLibraryState.page || 1);
    } else {
      loadStats(state.user);
    }
  } catch (error) {
    if (previousStatus) selectEl.value = previousStatus;
    showToast('状态保存失败: ' + normalizeApiError(error).message, 'error');
  } finally {
    selectEl.disabled = false;
  }
}

async function openParentWordEditor(recordId, page = parentWordLibraryState.page) {
  const editorEl = $('parentWordEditor');
  if (!editorEl) return;
  const cached = parentWordLibraryState.words.find(item => {
    const itemRecordId = item.recordId || item.id || item.record_id || '';
    return itemRecordId === recordId;
  });
  let item = cached;
  if (!item && recordId && !DEMO_MODE) {
    editorEl.innerHTML = '<div class="parent-result-empty">正在加载单词详情...</div>';
    item = await api(`/api/word?recordId=${encodeURIComponent(recordId)}`);
  }
  if (!item || item.exists === false) {
    editorEl.innerHTML = '<div class="parent-result-empty">没有找到这条单词记录。</div>';
    return;
  }
  parentWordLibraryState.page = Number(page) || parentWordLibraryState.page || 1;
  const word = item.word || item.Word || '';
  const meaning = item.meaning || item.Meaning || '';
  const cnMeaning = item.cnMeaning || item.CN_Meaning || '';
  const pos = item.pos || item.POS || '';
  const context = item.context || item.Context || '';
  const currentStatus = item.status || item.Status || 'Pending';
  const statusOptions = STATUS_OPTIONS.map(status => `<option value="${status}" ${status === currentStatus ? 'selected' : ''}>${STATUS_LABELS[status]}</option>`).join('');
  editorEl.innerHTML = `
    <div class="parent-word-editor-card">
      <div class="parent-word-editor-head">
        <strong>编辑单词：${escapeHtml(word)}</strong>
        <button class="btn btn-secondary btn-small" type="button" onclick="$('parentWordEditor').innerHTML=''">返回列表</button>
      </div>
      <input id="parentEditRecordId" type="hidden" value="${escapeHtml(recordId)}" />
      <label class="parent-field">
        <span>单词</span>
        <input id="parentEditWord" type="text" value="${escapeHtml(word)}" />
      </label>
      <label class="parent-field">
        <span>状态</span>
        <select id="parentEditStatus">${statusOptions}</select>
      </label>
      <label class="parent-field">
        <span>中文释义</span>
        <input id="parentEditCnMeaning" type="text" value="${escapeHtml(cnMeaning)}" />
      </label>
      <label class="parent-field">
        <span>英文释义</span>
        <input id="parentEditMeaning" type="text" value="${escapeHtml(meaning)}" />
      </label>
      <label class="parent-field">
        <span>词性</span>
        <input id="parentEditPos" type="text" value="${escapeHtml(pos)}" />
      </label>
      <label class="parent-field">
        <span>例句</span>
        <textarea id="parentEditContext" rows="3">${escapeHtml(context)}</textarea>
      </label>
      <button class="btn btn-primary btn-small" type="button" onclick="saveParentWord()">保存修改</button>
    </div>
  `;
}
async function saveParentWord() {
  const word = $('parentEditWord')?.value.trim();
  if (!word) {
    showToast('单词不能为空', 'warn');
    return;
  }
  showLoading('正在保存...');
  try {
    if (!DEMO_MODE) {
      await api('/api/word', {
        method: 'PUT',
        body: JSON.stringify({
          userId: state.user,
          recordId: $('parentEditRecordId')?.value || undefined,
          word,
          meaning: $('parentEditMeaning')?.value || '',
          cnMeaning: $('parentEditCnMeaning')?.value || '',
          pos: $('parentEditPos')?.value || '',
          context: $('parentEditContext')?.value || '',
          status: $('parentEditStatus')?.value || undefined
        })
      });
    }
    showToast('已保存单词记录', 'success');
    await loadParentWordLibrary(parentWordLibraryState.page || 1);
    loadStats(state.user);
  } catch (error) {
    showToast('保存失败: ' + normalizeApiError(error).message, 'error');
  } finally {
    hideLoading();
  }
}
async function loadParentLearningSettings() {
  const content = $('parentSettingsContent');
  try {
    const settingsData = DEMO_MODE
      ? { settings: { learningLevel: state.level, questionCacheStatus: 'ready' } }
      : await api(`/api/admin/userSettings?userId=${encodeURIComponent(state.user)}`);
    const cacheData = DEMO_MODE
      ? { status: { status: 'ready', totalQuestions: 30 } }
      : await api(`/api/admin/questionCache/status?userId=${encodeURIComponent(state.user)}`);
    const settings = settingsData.settings || {};
    const cacheStatus = cacheData.status || {};
    const currentLevel = settings.learningLevel || state.level || DEFAULT_LEVEL;
    content.innerHTML = `
      <label class="parent-field">
        <span>题干语言难度</span>
        <select id="parentLearningLevel">
          ${['小学','中学','高中','CET4_6_TOEFL'].map(level => `<option value="${level}" ${level === currentLevel ? 'selected' : ''}>${formatLearningLevel(level)}</option>`).join('')}
        </select>
      </label>
      <div class="parent-cache-status">
        <span>题目缓存</span>
        <strong>${escapeHtml(cacheStatus.status || settings.questionCacheStatus || 'unknown')}</strong>
        <small>${cacheStatus.totalQuestions ? '已缓存 ' + escapeHtml(cacheStatus.totalQuestions) + ' 题' : '后端会按学习设置生成题目缓存'}</small>
      </div>
      ${renderQuizDiagnosticsPanel()}
      <div class="parent-actions-row">
        <button class="btn btn-primary btn-small" type="button" onclick="saveParentLearningSettings()">保存设置</button>
        <button class="btn btn-secondary btn-small" type="button" onclick="rebuildParentQuestionCache()">重建缓存</button>
      </div>
    `;
  } catch (error) {
    content.innerHTML = `<div class="parent-result-empty">加载失败：${escapeHtml(normalizeApiError(error).message)}</div>`;
  }
}

async function saveParentLearningSettings() {
  const learningLevel = $('parentLearningLevel')?.value || state.level;
  showLoading('\u6b63\u5728\u4fdd\u5b58\u8bbe\u7f6e...');
  try {
    let data = {
      settings: {
        ...(state.learningSettings || {}),
        learningLevel,
        questionCacheStatus: 'ready',
      },
    };
    if (!DEMO_MODE) {
      data = await api('/api/admin/userSettings', {
        method: 'PUT',
        body: JSON.stringify({ userId: state.user, learningLevel })
      });
      if (data?.settings?.questionCacheStatus === 'building') {
        requestQuestionCacheRebuild(state.user);
        showToast('\u5b66\u4e60\u96be\u5ea6\u5df2\u4fdd\u5b58\uff0c\u65b0\u96be\u5ea6\u9898\u5e93\u6b63\u5728\u81ea\u52a8\u51c6\u5907\u4e2d\u2026', 'success');
      } else {
        showToast('\u5b66\u4e60\u8bbe\u7f6e\u5df2\u4fdd\u5b58', 'success');
      }
    } else {
      showToast('\u5b66\u4e60\u8bbe\u7f6e\u5df2\u4fdd\u5b58', 'success');
    }
    state.learningSettings = data?.settings || state.learningSettings;
    state.level = state.learningSettings?.learningLevel || learningLevel;
    saveUserDifficulty(state.user, state.level);
    updateLevelButtons();
    loadParentLearningSettings();
  } catch (error) {
    showToast('\u4fdd\u5b58\u5931\u8d25: ' + normalizeApiError(error).message, 'error');
  } finally {
    hideLoading();
  }
}

async function rebuildParentQuestionCache() {
  showLoading('正在重建题目缓存...');
  try {
    if (!DEMO_MODE) {
      await api('/api/admin/questionCache/rebuild', {
        method: 'POST',
        timeoutMs: 90000,
        body: JSON.stringify({ userId: state.user })
      });
    }
    showToast('缓存重建已提交', 'success');
    loadParentLearningSettings();
  } catch (error) {
    showToast('重建失败: ' + normalizeApiError(error).message, 'error');
  } finally {
    hideLoading();
  }
}

async function loadStats(user) {
  if (!user) return;
  showLoading('加载统计...');
  try {
    const data = DEMO_MODE
      ? generateDemoStats(user)
      : await api('/api/stats/' + encodeURIComponent(user));
    const totalWords = Number(data.totalWords || 0);
    const masteredWords = Number(data.masteredWords || 0);
    const consolidatingWords = Number(data.consolidatingWords || 0);
    const recognizedWords = Number(data.recognizedWords || 0);
    const unseenWords = data.unseenWords === undefined
      ? Math.max(0, totalWords - masteredWords - consolidatingWords - recognizedWords)
      : Number(data.unseenWords || 0);
    const totalTests = Number(data.totalTests || 0);
    const totalQuestions = Number(data.totalQuestions || 0);
    const correctCount = Number(data.correctCount || 0);
    const accuracyRate = data.accuracyRate || '0%';
    const lastTestTime = data.lastTestTime;
    const pct = totalWords > 0 ? Math.round(masteredWords / totalWords * 100) : 0;

    $('statsContent').innerHTML = `
      <section class="home-v2-progress-card" aria-label="词汇进度">
        <div class="home-v2-section-head">
          <span class="home-v2-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 5.5h8.8a2.7 2.7 0 0 1 0 5.4H6.5z"/><path d="M6.5 10.9h10a2.8 2.8 0 0 1 0 5.6h-10z"/></svg></span>
          <h2>词汇进度</h2>
        </div>
        <div class="home-v2-progress-body">
          <div class="home-v2-donut" aria-label="已掌握 ${escapeHtml(pct)}%" style="--pct:${pct};">
            <div class="home-v2-donut-core"><strong>${escapeHtml(pct)}%</strong><span>已掌握</span></div>
          </div>
          <ul class="home-v2-progress-list">
            <li><span>已掌握</span><strong>${escapeHtml(masteredWords)}</strong></li>
            <li><span>巩固中</span><strong>${escapeHtml(consolidatingWords)}</strong></li>
            <li><span>已认识</span><strong>${escapeHtml(recognizedWords)}</strong></li>
            <li><span>未开始</span><strong>${escapeHtml(unseenWords)}</strong></li>
            <li><span>总词汇</span><strong>${escapeHtml(totalWords)}</strong></li>
          </ul>
        </div>
      </section>
      <section class="home-v2-stats-grid" aria-label="学习统计">
        <div class="home-v2-stat-card">
          <div class="home-v2-stat-top"><span class="home-v2-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5 14.3 9l5 .7-3.6 3.5.8 4.9L12 15.8l-4.5 2.3.8-4.9L4.7 9.7l5-.7z"/></svg></span><span>考核次数</span></div>
          <strong class="home-v2-stat-value">${escapeHtml(totalTests)}</strong>
          <span class="home-v2-stat-sub home-v2-stat-sub-placeholder" aria-hidden="true">${escapeHtml(correctCount)}/${escapeHtml(totalQuestions)}</span>
        </div>
        <div class="home-v2-stat-card">
          <div class="home-v2-stat-top"><span class="home-v2-stat-icon green" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 12.5 4 4L18.5 8"/></svg></span><span>正确率</span></div>
          <strong class="home-v2-stat-value green">${escapeHtml(accuracyRate)}</strong>
          <span class="home-v2-stat-sub">${escapeHtml(correctCount)}/${escapeHtml(totalQuestions)}</span>
        </div>
      </section>
      ${lastTestTime ? `<p class="home-v2-last-test"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7.5v4.8l3.1 1.7"/></svg>上次考核：${escapeHtml(formatDate(lastTestTime))}</p>` : ''}
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
  clearQuizDraft();
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
      saveQuizDraft();
      navigateTo('quiz');
      renderQuestion(0);
      return;
    }
    const data = await api('/api/quiz', {
      method: 'POST',
      timeoutMs: 70000,
      body: JSON.stringify({ user: state.user, level: state.level, mode: state.mode })
    });
    if (data.level === state.level && data.difficultyApplied === false) {
      showToast(`${formatLearningLevel(state.level)}\u9898\u5e72\u8fd8\u6ca1\u6709\u51c6\u5907\u597d\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5`, 'info');
      return;
    }
    state.quizDiagnostics = buildQuizDiagnosticsSummary(data);
    if (data.warning) showToast(data.warning, 'info');
    state.quiz = data;
    state.currentQuestion = 0;
    state.answers = new Array(data.questions.length).fill(null);
    state.confidences = new Array(data.questions.length).fill(null);
    saveQuizDraft();
    navigateTo('quiz');
    renderQuestion(0);
  } catch(e) {
    if (e.code === 'QUESTION_CACHE_NOT_READY') {
      requestQuestionCacheRebuild(state.user);
      const ready = e.diagnostics?.readyCount ?? 0;
      const required = e.diagnostics?.requiredCount ?? 10;
      showToast(`${formatLearningLevel(state.level)}题库正在准备中（${ready}/${required}），请稍后再试`, 'info');
    } else {
      showToast('生成题目失败: ' + normalizeApiError(e).message, 'error');
    }
  } finally {
    hideLoading();
  }
}

function isMeaningReviewQuestion(question) {
  return Number(question?.type) === 4 || question?.answerMode === 'cn_meaning';
}

function meaningAnswerValue(index) {
  return String(state.answers[index] ?? '');
}
function renderQuestion(idx) {
  const q = state.quiz.questions[idx];
  const total = state.quiz.questions.length;
  $('quizProgressFill').style.width = ((idx+1)/total*100) + '%';
  $('quizProgressText').textContent = idx + 1;
  $('quizTotalText').textContent = total;

  if (isMeaningReviewQuestion(q)) {
    const answer = meaningAnswerValue(idx);
    $('questionArea').innerHTML = `
      <div class="question-card meaning-review-card">
        <div class="question-type-badge type4">CN 释义回忆</div>
        <div class="question-text meaning-review-word">${escapeHtml(q.word || '')}</div>
        <label class="meaning-answer-label" for="meaningAnswerInput">请输入这个单词的中文释义</label>
        <textarea
          class="meaning-answer-input"
          id="meaningAnswerInput"
          rows="4"
          placeholder="例如：晋升；提升"
          oninput="setMeaningAnswer(${idx}, this.value)"
        >${escapeHtml(answer)}</textarea>
      </div>
    `;
    const isLastQuestion = idx === total - 1;
    const canContinue = answer.trim().length > 0;
    $('prevBtn').style.visibility = idx === 0 ? 'hidden' : 'visible';
    $('nextBtn').style.display = isLastQuestion ? 'none' : 'flex';
    $('submitBtn').style.display = isLastQuestion ? 'flex' : 'none';
    $('nextBtn').disabled = !canContinue;
    $('submitBtn').disabled = !canContinue;
    return;
  }
  const types = {1:'\u8bed\u5883\u586b\u7a7a', 2:'\u82f1\u82f1\u91ca\u4e49', 3:'\u4e2d\u6587\u9009\u8bcd'};
  const typeClasses = {1:'type1', 2:'type2', 3:'type3'};
  const typeIcons = {1:'\u25a1', 2:'EN', 3:'CN'};

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
      <span>${escapeHtml(formatOptionDisplayText(opt.replace(/^[A-D]\.\s*/, ''), q.options, q))}</span>
    </button>`;
  }).join('');
  const confidence = state.confidences[idx];
  const confidenceHtml = state.answers[idx] === null ? '' : `
    <div class="confidence-panel">
      <div class="confidence-label">这道题你是确定认识，还是猜的 / 不确定？</div>
      <div class="confidence-actions">
        <button class="confidence-btn ${confidence === 'sure' ? 'selected' : ''}" onclick="selectConfidence(${idx}, 'sure')">确定认识</button>
        <button class="confidence-btn ${confidence === 'guess' ? 'selected' : ''}" onclick="selectConfidence(${idx}, 'guess')">猜的 / 不确定</button>
      </div>
      <div class="confidence-hint">猜对仍计入本次得分，但不会作为“已掌握”的证据。</div>
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

function setMeaningAnswer(qIdx, value) {
  state.answers[qIdx] = value;
  saveCurrentSessionProgress();
  const canContinue = String(value || '').trim().length > 0;
  $('nextBtn').disabled = !canContinue;
  $('submitBtn').disabled = !canContinue;
}
function selectOption(qIdx, optIdx) {
  state.answers[qIdx] = optIdx;
  if (state.confidences[qIdx] === null) {
    state.confidences[qIdx] = 'sure';
  }
  saveCurrentSessionProgress();
  renderQuestion(state.currentQuestion);
}

function selectConfidence(qIdx, confidence) {
  state.confidences[qIdx] = confidence;
  saveCurrentSessionProgress();
  renderQuestion(state.currentQuestion);
}

function prevQuestion() {
  if (state.currentQuestion > 0) {
    state.currentQuestion--;
    saveCurrentSessionProgress();
    renderQuestion(state.currentQuestion);
  }
}

function canLeaveCurrentQuestion() {
  const index = state.currentQuestion;
  const question = state.quiz?.questions?.[index];
  if (isMeaningReviewQuestion(question)) {
    if (!meaningAnswerValue(index).trim()) {
      showToast('请先输入中文释义', 'info');
      return false;
    }
    return true;
  }
  if (state.answers[index] === null) {
    showToast('请选择一个答案', 'info');
    return false;
  }
  if (state.confidences[index] === null) {
    showToast('请选择确定认识或猜的/不确定', 'info');
    return false;
  }
  return true;
}

function nextQuestion() {
  if (!canLeaveCurrentQuestion()) return;
  if (state.currentQuestion < state.quiz.questions.length - 1) {
    state.currentQuestion++;
    saveCurrentSessionProgress();
    renderQuestion(state.currentQuestion);
  }
}

function waitForMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function submitWithTimeoutConfirmation(path, payload) {
  const request = () => api(path, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  try {
    return await request();
  } catch (error) {
    if (error?.name === 'AbortError') {
      showLoading('提交时间较长，正在确认结果...');
      await waitForMs(1200);
      return await request();
    }
    throw error;
  }
}

async function submitQuizToBackend(payload) {
  return submitWithTimeoutConfirmation('/api/submit', payload);
}

async function submitReviewToBackend(reviewId, payload) {
  return submitWithTimeoutConfirmation(`/api/reviews/${encodeURIComponent(reviewId)}/submit`, payload);
}
async function submitQuiz() {
  if (!state.quiz) return;
  if (state.submitting) return;
  if (!canLeaveCurrentQuestion()) return;
  const unanswered = state.quiz.questions.findIndex((question, index) => isMeaningReviewQuestion(question) ? !meaningAnswerValue(index).trim() : state.answers[index] === null);
  if (unanswered !== -1) {
    showToast(`还有第 ${unanswered + 1} 题未作答`, 'info');
    state.currentQuestion = unanswered;
    renderQuestion(unanswered);
    return;
  }
  const unconfirmed = state.quiz.questions.findIndex((question, index) => !isMeaningReviewQuestion(question) && state.confidences[index] === null);
  if (unconfirmed !== -1) {
    showToast('请确认第 ' + (unconfirmed + 1) + ' 题是“确定认识”还是“猜的 / 不确定”', 'info');
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
        const answer = state.answers[i];
        if (isMeaningReviewQuestion(q)) {
          const yourText = String(answer ?? '').trim();
          const expected = q.correctMeaning || '';
          const normalizedYour = yourText.replace(/[\s，,。；;、]/g, '');
          const normalizedExpected = expected.replace(/[\s，,。；;、]/g, '');
          const isCorrect = Boolean(normalizedYour) && (
            normalizedYour.includes(normalizedExpected) ||
            normalizedExpected.includes(normalizedYour)
          );
          if (isCorrect) correct++;
          return {
            q: i+1,
            word: q.word,
            recordId: q.recordId || q.word,
            your: yourText,
            answer: expected,
            correct: isCorrect,
            confidence: ''
          };
        }
        const yourIdx = answer;
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
      data = await submitReviewToBackend(state.session.reviewId, {
        user: state.user,
        answers: state.answers.map((answer, i) => isMeaningReviewQuestion(state.quiz.questions[i])
          ? { text: String(answer ?? '').trim() }
          : { option: answer, confidence: state.confidences[i] })
      });
    } else {
      const payload = {
        user: state.user,
        testId: state.quiz.testId,
        answers: state.answers.map((answer, i) => isMeaningReviewQuestion(state.quiz.questions[i])
          ? { text: String(answer ?? '').trim() }
          : { option: answer, confidence: state.confidences[i] })
      };
      data = await submitQuizToBackend(payload);
    }
    state.quiz.result = data;

    if (state.session.kind === 'quiz') {
      clearQuizDraft();
      addGameRewardToBank(data.gameReward, state.user, state.quiz?.testId || data.testId);
    }
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
      saveCurrentSessionProgress();
    }
    navigateTo('results');
    renderResults(data);
  } catch(e) {
    showToast('提交失败: ' + normalizeApiError(e).message, 'error');
  } finally {
    state.submitting = false;
    $('submitBtn').disabled = false;
    hideLoading();
  }
}

// ========== Results ==========
const ENCOURAGE = {
  perfect: ['满分！你就是单词大师！', '全部答对，太厉害了！', '完美通关，学习状态很好！'],
  great: ['表现很棒，继续加油！', '掌握得不错，再接再厉！', '优秀！离满分不远了！'],
  good: ['还不错，继续努力！', '已经及格了，下次会更好！', '稳住，再复习一下就能全对！'],
  poor: ['还需要多复习哦！', '别灰心，多练几次就好了！', '加油！每一次都是进步！'],
};
function getEncourage(correct, total) {
  const r = correct / total;
  if (r >= 1) return ENCOURAGE.perfect[Math.floor(Math.random() * ENCOURAGE.perfect.length)];
  if (r >= 0.8) return ENCOURAGE.great[Math.floor(Math.random() * ENCOURAGE.great.length)];
  if (r >= 0.6) return ENCOURAGE.good[Math.floor(Math.random() * ENCOURAGE.good.length)];
  return ENCOURAGE.poor[Math.floor(Math.random() * ENCOURAGE.poor.length)];
}

let _showAnalysis = false;

function buildAnimalGardenRewardHtml(rewardSummary) {
  if (!rewardSummary || state.session.kind !== 'quiz') return '';
  const items = Array.isArray(rewardSummary.rewards) ? rewardSummary.rewards : [];
  const milestones = Array.isArray(rewardSummary.milestones) ? rewardSummary.milestones : [];
  const progress = rewardSummary.progress || {};
  const nextMilestone = progress.nextMilestone || rewardSummary.nextMilestone || 10;
  const masteredMeanings = progress.masteredMeanings ?? rewardSummary.masteredMeanings ?? 0;
  const rewardItems = items.slice(0, 4).map(item => `
    <span class="animal-reward-pill">${escapeHtml(item.label || item.name || item.type || '花园奖励')}</span>
  `).join('');
  const milestoneHtml = milestones.length
    ? `<div class="animal-garden-line">达成 ${milestones.map(item => escapeHtml(item.label || item.name || ((item.size || '') + ' milestone'))).join('、')}</div>`
    : '';
  return `
    <div class="animal-garden-card">
      <div class="animal-garden-icon">🌱</div>
      <div class="animal-garden-body">
        <div class="animal-garden-title">动物花园奖励</div>
        <div class="animal-garden-line">已掌握释义 ${escapeHtml(masteredMeanings)} 个；下一个 milestone：${escapeHtml(nextMilestone)} 个释义。</div>
        ${milestoneHtml}
        ${rewardItems ? `<div class="animal-reward-list">${rewardItems}</div>` : '<div class="animal-garden-line">继续答对可获得小动物、装备和花园材料。</div>'}
      </div>
    </div>
  `;
}

function renderResults(data) {
  const { correct, total, accuracy, masteredWords } = data;
  const pass = correct / total >= 0.6;
  const pct = Math.round(correct/total*100);
  const encourage = getEncourage(correct, total);
  _showAnalysis = state.session.kind === 'review';
  state.session.analysisViewed = _showAnalysis;
  const reward = data.gameReward;
  const animalGardenHtml = buildAnimalGardenRewardHtml(data.rewardSummary);
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
      const typeNames = {1:'语境填空', 2:'英英释义', 3:'中文选词', 4:'中文释义回忆'};
      const isMeaningReview = isMeaningReviewQuestion(q);

      // 构建完整题干展示
      let contextDisplay = '';
      let explanationHtml = '';

      if (isMeaningReview) {
        contextDisplay = '请写出这个单词的中文释义';
        explanationHtml = buildMeaningReviewExplanation(q, r, escapeHtml);
      } else if (q?.type === 1 && q?.context) {
        // Type 1: 显示上下文，空白处用 ___ 占位
        contextDisplay = escapeHtml(q.context).replace(/_____/g, '<span class="inline-blank">&nbsp;</span>');
      } else if (q?.type === 2 && q?.context) {
        contextDisplay = '📘 ' + escapeHtml(q.context);
      } else if (q?.type === 3 && q?.context) {
        contextDisplay = '🌐 ' + escapeHtml(q.context);
      }
      if (!isMeaningReview) {
        explanationHtml = buildOptionMeaningsExplanation(q, escapeHtml)
          + buildQuestionExplanation(q, r, escapeHtml);
      }

      // 构建选项列表
      let optionsHtml = '';
      if (isMeaningReview) {
        optionsHtml = `<div class="detail-line"><strong>你的答案：</strong>${escapeHtml(r.your || '（未作答）')}</div>
          <div class="detail-line"><strong>参考释义：</strong>${escapeHtml(r.answer || q?.correctMeaning || '暂无参考释义')}</div>`;
      } else if (q?.options && q.options.length > 0) {
        optionsHtml = q.options.map(opt => {
          const letter = opt[0];
          const isCorrect = letter === q.answer;
          const isUserChoice = letter === r.your;
          let cls = 'opt-item';
          if (isCorrect) cls += ' opt-correct';
          if (isUserChoice && !r.correct) cls += ' opt-wrong';
          let tag = '';
          if (isCorrect && isUserChoice) tag = '<span class="opt-tag tag-correct">✓ 正确答案</span>';
          else if (isCorrect) tag = '<span class="opt-tag tag-correct">✓ 正确答案</span>';
          else if (isUserChoice) tag = '<span class="opt-tag tag-wrong">你的选择</span>';
          const rawWord = String(opt).replace(/^[A-D]\.\s*/, '');
          const displayWord = formatOptionDisplayText(rawWord, q.options, q);
          return `<div class="${cls}"><strong>${escapeHtml(letter)}.</strong> ${escapeHtml(displayWord)} ${tag}</div>`;
        }).join('');
      } else {
        optionsHtml = `<div style="color:#999;font-size:13px;padding:8px 0;">选项未保存（历史记录）</div>`;
      }

      detailsHtml += `
        <div class="result-analysis-card ${r.correct ? 'correct' : 'wrong'}">
          <div class="row">
            <span class="word">${escapeHtml(r.word)}</span>
            <span class="status-badge ${r.correct ? 'correct' : 'wrong'}">${r.correct ? '✓ 正确' : '× 错误'}</span>
          </div>
          <div class="row" style="font-size:13px;color:var(--text-secondary);margin-top:4px;">
            <span>${typeNames[q?.type] || ''} · 第 ${i+1} 题</span>
            <span>${isMeaningReview ? '中文释义回忆' : (r.confidence === 'guess' ? '猜的 / 不确定：本题不计掌握证据' : '确定认识')}</span>
          </div>

          <div class="ctx-box">
            <div class="ctx-label">题干：</div>
            <div class="ctx-text">${contextDisplay}</div>
          </div>

          <div class="opts-box">
            <div class="opts-label">${isMeaningReview ? '答案：' : '选项：'}</div>
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
      ${masteredWords && masteredWords.length ? `<div class="mastered-tag" style="background:#E8F5E9;color:var(--green);margin-top:8px;">✓ 新掌握 ${masteredWords.length} 个单词</div>` : ''}
      ${rewardHtml}
      ${animalGardenHtml}
    </div>

    <div id="analysisArea" style="display:${_showAnalysis ? 'block' : 'none'};margin-bottom:20px;">
      <div class="section-title">逐题回顾</div>
      ${detailsHtml}
    </div>

    <div id="resultActionPanel" class="review-action-panel"></div>
    <div id="animalGardenMount"></div>

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
    const info = DEMO_WORDS.find(word => word.word === source.word) || {};
    return {
      type: 4,
      answerMode: 'cn_meaning',
      word: source.word,
      recordId: source.recordId || source.word,
      context: '',
      options: [],
      correctMeaning: info.cn || '',
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
          timeoutMs: 30000,
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
    saveCurrentSessionProgress();
    navigateTo('quiz');
    renderQuestion(0);
  } catch (error) {
    showToast('生成错题复习失败: ' + normalizeApiError(error).message, 'error');
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
    ${renderGameTimePrompt()}
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
    card.addEventListener('click', () => openHistoryDetail(item));

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

    const detailHint = document.createElement('div');
    detailHint.className = 'history-detail-hint';
    detailHint.textContent = '查看题目 · ' + (item.questions?.length || item.total || 0) + ' 题';
    card.append(top, bottom, detailHint);
    container.appendChild(card);
  });
  content.appendChild(container);
}


function historyTypeLabel(type) {
  if (type === 1) return '语境填空';
  if (type === 2) return '英英释义';
  if (type === 3) return '中文选词';
  if (type === 4) return '中文释义回忆';
  return '题目';
}

function optionLetter(value) {
  return String(value || '').trim().charAt(0).toUpperCase();
}

function optionTextByLetter(options, letter) {
  const wanted = optionLetter(letter);
  if (!wanted) return '未作答';
  const match = (options || []).find(opt => optionLetter(opt) === wanted);
  return match ? String(match).replace(/^[A-D]\.\s*/, '') : wanted;
}

function openHistoryDetail(item) {
  const pass = item.correct / item.total >= 0.6;
  const pct = item.total > 0 ? Math.round(item.correct / item.total * 100) : 0;
  $('hdDate').textContent = formatDate(item.time);
  const scoreEl = $('hdScore');
  scoreEl.textContent = item.correct + '/' + item.total + '  ' + pct + '%';
  scoreEl.className = 'hd-score ' + (pass ? 'pass' : 'fail');

  const body = $('hdBody');
  body.replaceChildren();
  const questions = item.questions || [];
  if (!questions.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = '这次考核暂时没有保存题目明细';
    body.appendChild(empty);
  }
  questions.forEach((q, i) => {
    const card = document.createElement('div');
    card.className = 'hd-q';
    const rawStem = escapeHtml(q.question || q.word || '');
    const stemHtml = q.type === 1
      ? rawStem.replace(/_____/g, '<span class="blank"></span>')
      : rawStem;
    const optsHtml = (q.options || []).map(opt => {
      const letter = optionLetter(opt);
      const word = String(opt).replace(/^[A-D]\.\s*/, '');
      let cls = 'hd-opt';
      if (letter === optionLetter(q.correctAnswer)) cls += ' correct';
      else if (letter === optionLetter(q.yourAnswer) && !q.isCorrect) cls += ' wrong';
      return '<div class="' + cls + '"><strong>' + escapeHtml(letter) + '.</strong> ' + escapeHtml(word) + '</div>';
    }).join('');
    const answerSummary =
      '<div class="hd-answer-row">' +
        '<span>孩子答案：' + escapeHtml(optionTextByLetter(q.options, q.yourAnswer)) + '</span>' +
        '<span>正确答案：' + escapeHtml(optionTextByLetter(q.options, q.correctAnswer)) + '</span>' +
      '</div>';
    card.innerHTML =
      '<div class="hd-q-head">' +
        '<span class="hd-q-num">第 ' + (i + 1) + ' 题</span>' +
        '<span class="hd-q-type">' + historyTypeLabel(q.type) + '</span>' +
        '<span class="hd-q-result ' + (q.isCorrect ? 'pass' : 'fail') + '">' + (q.isCorrect ? '答对' : '答错') + '</span>' +
      '</div>' +
      '<div class="hd-q-word">' + escapeHtml(q.word || '') + '</div>' +
      '<div class="hd-q-stem">' + stemHtml + '</div>' +
      '<div class="hd-opts">' + (optsHtml || '<div class="hd-opt muted">选项未保存</div>') + '</div>' +
      answerSummary;
    body.appendChild(card);
  });
  $('hdBackdrop').classList.add('active');
  $('hdSheet').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeHistoryDetail() {
  $('hdBackdrop').classList.remove('active');
  $('hdSheet').classList.remove('active');
  document.body.style.overflow = '';
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

function startDemoGamePreviewSession() {
  state.user = 'yusi';
  state.users = ['yusi'];
  state.level = loadUserDifficulty(state.user);
  state.mode = 'real';
  state.historyMode = 'real';
  setSessionUser(state.user);
  showAppPage();
  applyEnvironmentControls();
  renderUsers(state.users);
  updateLevelButtons();
  loadStats(state.user);
  setBankedGameMinutes(Math.max(getBankedGameMinutes(), 12));
  setTimeout(startGamePreview, 250);
}

function initApp() {
  updateAuthMode('login');
  initializeAppHistory();
  if (GAME_PREVIEW_MODE) {
    startDemoGamePreviewSession();
    return;
  }
  applyEnvironmentControls();
  const savedUser = getSessionUser();
  if (savedUser) {
    state.user = savedUser;
    state.users = [savedUser];
    state.level = loadUserDifficulty(savedUser);
    showAppPage();
    applyEnvironmentControls();
    renderUsers(state.users);
    updateLevelButtons();
    loadHome();
    return;
  }
  showLoginPage();
}

// ========== Init ==========
initApp();
