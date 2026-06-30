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
const LEVEL_LABELS = { '中学': '初中' };

function formatLearningLevel(level) {
  return LEVEL_LABELS[level] || level || DEFAULT_LEVEL;
}
const SESSION_USER_KEY = 'wordbot:session-user';
const LOCAL_AUTH_USERS_KEY = 'wordbot:local-auth-users';
const GAME_TIME_BANK_KEY_PREFIX = 'wordbot:game-time-bank:';
const ANIMAL_GARDEN_STATE_KEY_PREFIX = 'wordbot:animal-garden:';
const REWARD_GAME_ASSET_MANIFEST = 'assets/reward-game/v1/manifest.json';
const SEEDED_LOCAL_USERS = ['yusi', 'qiuqiu'];
const state = {
  user: null,
  authMode: 'login',
  authLoginMethod: 'password',
  parentAccess: false,
  level: DEFAULT_LEVEL,
  mode: 'real',
  historyMode: 'real',
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
function addGameRewardToBank(reward, user = state.user) {
  if (!reward?.eligible || !reward.minutes || !user) return getBankedGameMinutes(user);
  return setBankedGameMinutes(getBankedGameMinutes(user) + Number(reward.minutes), user);
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
  const host = $('animalGardenMount');
  if (host) {
    host.innerHTML = renderAnimalGardenGame();
    mountCurrentRewardGardenArt();
  }
}

function keepBankedGameForLater() {
  showToast('小游戏时间已存留：' + getBankedGameMinutes() + ' 分钟', 'success');
}
function updateAuthMode(mode) {
  state.authMode = mode;
  const isRegister = mode === 'register';
  if (isRegister) state.authLoginMethod = 'password';
  const isOtpLogin = !isRegister && state.authLoginMethod === 'otp';

  $('loginTab')?.classList.toggle('active', !isRegister);
  $('registerTab')?.classList.toggle('active', isRegister);
  $('authMethodWrap').style.display = isRegister ? 'none' : 'flex';
  $('authPasswordMethod')?.classList.toggle('active', !isOtpLogin);
  $('authOtpMethod')?.classList.toggle('active', isOtpLogin);
  $('authUsernameWrap').style.display = isOtpLogin ? 'none' : 'flex';
  $('authPhoneWrap').style.display = (isRegister || isOtpLogin) ? 'flex' : 'none';
  $('authPasswordWrap').style.display = isOtpLogin ? 'none' : 'flex';
  $('authConfirmWrap').style.display = isRegister ? 'flex' : 'none';
  $('authOtpWrap').style.display = isOtpLogin ? 'flex' : 'none';
  $('authIdentifierLabel').textContent = isRegister ? '用户名' : '用户名/手机号';
  authSubmitBtn.textContent = isRegister ? '注册并登录' : (isOtpLogin ? '验证码登录' : '登录');
  authHint.textContent = isRegister
    ? '注册后可在任意浏览器登录；手机号会绑定到这个账户。'
    : (isOtpLogin
      ? '输入绑定手机号和验证码登录。'
      : '可以用用户名或手机号登录。');
}

function setAuthMode(mode) {
  updateAuthMode(mode);
}

function setAuthLoginMethod(method) {
  state.authLoginMethod = method === 'otp' ? 'otp' : 'password';
  updateAuthMode(state.authMode);
}

function showLoginPage() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $('pageLogin').classList.add('active');
}

function showAppPage() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $('pageHome').classList.add('active');
}

function applyEnvironmentControls() {
  const modeWrap = $('modeSelectorWrap');
  const historyWrap = $('historyModeSelectorWrap');
  const gamePreviewBtn = $('gamePreviewBtn');
  if (modeWrap) modeWrap.style.display = DEV_MODE ? 'block' : 'none';
  if (historyWrap) historyWrap.style.display = DEV_MODE ? 'flex' : 'none';
  if (gamePreviewBtn) gamePreviewBtn.style.display = DEV_MODE ? 'flex' : 'none';
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

function navigateTo(page) {
  if (!state.user && page !== 'login') {
    showLoginPage();
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $('page' + page.charAt(0).toUpperCase() + page.slice(1)).classList.add('active');
  if (page === 'home') loadHome();
  if (page === 'history') loadHistory();
}

// ========== Auth ==========
function normalizeUsername(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function handleUnregisteredPasswordLogin(error) {
  const message = normalizeApiError(error).message;
  if (state.authMode !== 'login' || !message.includes('尚未注册密码')) return false;
  updateAuthMode('register');
  authPasswordConfirm.value = authPassword.value;
  authHint.textContent = '这个账号还没有绑定服务端密码。首次使用请再点一次注册并登录，之后任何浏览器都可以直接登录。';
  showToast('首次使用请再点一次注册并登录，完成密码绑定', 'info');
  return true;
}

async function requestLoginOtp() {
  const phone = normalizePhone(authPhone.value);
  if (!/^\d{11}$/.test(phone)) {
    showToast('请输入正确的手机号', 'error');
    return;
  }
  showLoading('正在发送验证码...');
  try {
    const data = await api('/api/auth/requestOtp', {
      method: 'POST',
      body: JSON.stringify({ phone, purpose: 'login' })
    });
    if (data.devOtp) {
      authOtpCode.value = data.devOtp;
      authHint.textContent = '本地预览验证码：' + data.devOtp;
    }
    showToast('验证码已发送', 'success');
  } catch (error) {
    showToast('发送验证码失败: ' + normalizeApiError(error).message, 'error');
  } finally {
    hideLoading();
  }
}

async function submitAuth() {
  const username = normalizeUsername(authUsername.value);
  const phone = normalizePhone(authPhone.value);
  const password = authPassword.value;
  const confirm = authPasswordConfirm.value;
  const otp = authOtpCode?.value?.trim() || '';

  if (state.authMode === 'register') {
    if (!username) { showToast('请输入用户名', 'error'); return; }
    if (!/^\d{11}$/.test(phone)) { showToast('请输入正确的手机号', 'error'); return; }
    if (!password || password.length < 4) { showToast('密码至少需要 4 位', 'error'); return; }
    if (password !== confirm) { showToast('两次输入的密码不一致', 'error'); return; }
  } else if (state.authLoginMethod === 'otp') {
    if (!/^\d{11}$/.test(phone)) { showToast('请输入正确的手机号', 'error'); return; }
    if (!/^\d{6}$/.test(otp)) { showToast('请输入 6 位验证码', 'error'); return; }
  } else {
    if (!username) { showToast('请输入用户名或手机号', 'error'); return; }
    if (!password || password.length < 4) { showToast('密码至少需要 4 位', 'error'); return; }
  }

  const isRegister = state.authMode === 'register';
  const isOtpLogin = !isRegister && state.authLoginMethod === 'otp';
  const endpoint = isRegister ? '/api/auth/register' : (isOtpLogin ? '/api/auth/otpLogin' : '/api/auth/login');
  const body = isRegister
    ? { username, phone, password }
    : (isOtpLogin ? { phone, otp } : { identifier: username, password });

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
  clearSessionUser();
  state.user = null;
  state.quiz = null;
  state.answers = [];
  state.confidences = [];
  state.parentAccess = false;
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
    empty.style.cssText = 'color:var(--text-secondary);font-size:14px;';
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
  text.style.flex = '1';
  text.append(
    document.createTextNode('当前用户：' + currentUser),
    Object.assign(document.createElement('small'), {
      textContent: DEV_MODE ? '开发预览模式' : '正式学习模式',
    })
  );
  const logoutButton = document.createElement('button');
  logoutButton.className = 'level-btn';
  logoutButton.type = 'button';
  logoutButton.textContent = '退出';
  logoutButton.addEventListener('click', logout);
  card.append(avatar, text, logoutButton);
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
  resetParentConsole();
  updateLevelButtons();
  renderUsers(state.users);
  syncLearningSettingsFromServer(user).finally(() => loadStats(user));
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

async function ensureLevelCacheReadyForQuiz(user, level) {
  if (DEMO_MODE) return true;
  const data = await api(`/api/admin/questionCache/status?userId=${encodeURIComponent(user)}`);
  const status = data.status || {};
  const requiredCount = 10;
  if (isLevelCacheReady(status, level, requiredCount)) return true;
  const readyCount = getLevelCacheReadyCount(status, level);
  showToast(`${formatLearningLevel(level)}\u9898\u5e93\u51c6\u5907\u4e2d\uff08${readyCount}/${requiredCount}\uff09\uff0c\u8bf7\u5728\u5bb6\u957f\u63a7\u5236\u53f0\u91cd\u5efa\u7f13\u5b58\u540e\u7a0d\u540e\u518d\u8bd5`, 'info');
  return false;
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

// ========== Home ==========
async function loadHome() {
  if (!state.user) {
    showLoginPage();
    return;
  }
  showLoading('加载用户数据...');
  try {
    if (DEMO_MODE) {
      state.users = [state.user];
      renderUsers(state.users);
      await loadStats(state.user);
      showToast('当前为演示模式，数据不会写入服务器', 'info');
      hideLoading();
      return;
    }
    state.users = [state.user];
    renderUsers(state.users);
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
}

function ensureParentAccess() {
  if (state.parentAccess) return true;
  openParentConsole();
  showToast('请先完成家长手机号和密码验证', 'info');
  return false;
}

async function verifyParentPassword() {
  const phone = normalizePhone($('parentPhoneInput')?.value);
  const password = $('parentPasswordInput')?.value || '';
  if (!/^\d{11}$/.test(phone) || !password) {
    showToast('请输入手机号和登录密码', 'error');
    return;
  }
  showLoading('正在验证...');
  try {
    const data = DEMO_MODE
      ? { user: state.user }
      : await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier: phone, password })
        });
    if (normalizeUsername(data.user) !== normalizeUsername(state.user)) {
      throw new Error('手机号不属于当前账户');
    }
    state.parentAccess = true;
    showParentTools();
    showToast('已进入家长控制台', 'success');
  } catch (error) {
    showToast('验证失败: ' + normalizeApiError(error).message, 'error');
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
        <textarea id="parentWordsInput" rows="6" placeholder="一行一个英文单词，例如&#10;resilient&#10;genuine&#10;feasible"></textarea>
      </label>
      <div class="parent-help">当前会把单词加入 ${escapeHtml(state.user)} 的词库；英文释义、中文释义、例句和干扰项由后端生成。</div>
      <button class="btn btn-primary btn-small" type="button" onclick="submitParentWords()">提交录入</button>
    `;
    return;
  }

  if (tool === 'searchWord') {
    panel.innerHTML = `
      <div class="parent-panel-head">
        <strong>查询/编辑</strong>
        <button type="button" onclick="closeParentTool()" aria-label="关闭">×</button>
      </div>
      <div class="parent-inline-form">
        <input id="parentSearchWordInput" type="text" placeholder="输入英文单词" onkeydown="if(event.key==='Enter')searchParentWord()" />
        <button class="btn btn-secondary btn-small" type="button" onclick="searchParentWord()">查询</button>
      </div>
      <div id="parentWordResult" class="parent-result-empty">可查询当前用户词库中的单词记录。</div>
    `;
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
  }
}

function closeParentTool() {
  const panel = getParentToolPanel();
  if (!panel) return;
  panel.style.display = 'none';
  panel.innerHTML = '';
}

function parseParentWordsInput(value) {
  return Array.from(new Set(String(value || '')
    .split(/[\n,，;；\s]+/)
    .map(word => word.trim().toLowerCase())
    .filter(Boolean)));
}

async function submitParentWords() {
  const input = $('parentWordsInput');
  const words = parseParentWordsInput(input?.value);
  if (!words.length) {
    showToast('请先输入至少一个单词', 'warn');
    return;
  }
  showLoading('正在录入单词...');
  try {
    const result = DEMO_MODE
      ? { success: true, count: words.length }
      : await api('/api/admin/addWords', {
          method: 'POST',
          timeoutMs: 90000,
          body: JSON.stringify({ targetUser: state.user, words })
        });
    showToast('已提交 ' + (result.count || words.length) + ' 个单词', 'success');
    if (input) input.value = '';
    loadStats(state.user);
  } catch (error) {
    showToast('录入失败: ' + normalizeApiError(error).message, 'error');
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
  resultEl.textContent = '正在查询...';
  try {
    const data = DEMO_MODE
      ? { exists: true, word, meaning: 'demo meaning', cnMeaning: '演示释义', pos: 'n.', context: `A demo sentence uses ${word}.` }
      : await api(`/api/word?userId=${encodeURIComponent(state.user)}&word=${encodeURIComponent(word)}`);
    if (!data || data.exists === false) {
      resultEl.innerHTML = `<div class="parent-result-empty">没有找到 ${escapeHtml(word)}，可以先在“录入单词”里添加。</div>`;
      return;
    }
    const recordId = data.recordId || data.id || '';
    resultEl.innerHTML = `
      <div class="parent-word-editor">
        <input id="parentEditRecordId" type="hidden" value="${escapeHtml(recordId)}" />
        <label class="parent-field"><span>英文</span><input id="parentEditWord" value="${escapeHtml(data.word || word)}" /></label>
        <label class="parent-field"><span>英文释义</span><textarea id="parentEditMeaning" rows="3">${escapeHtml(data.meaning || data.Meaning || '')}</textarea></label>
        <label class="parent-field"><span>中文释义</span><input id="parentEditCnMeaning" value="${escapeHtml(data.cnMeaning || data.CN_Meaning || '')}" /></label>
        <label class="parent-field"><span>词性</span><input id="parentEditPos" value="${escapeHtml(data.pos || data.POS || '')}" /></label>
        <label class="parent-field"><span>例句</span><textarea id="parentEditContext" rows="3">${escapeHtml(data.context || data.Context || '')}</textarea></label>
        <button class="btn btn-primary btn-small" type="button" onclick="saveParentWord()">保存修改</button>
      </div>
    `;
  } catch (error) {
    resultEl.innerHTML = `<div class="parent-result-empty">查询失败：${escapeHtml(normalizeApiError(error).message)}</div>`;
  }
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
          context: $('parentEditContext')?.value || ''
        })
      });
    }
    showToast('已保存单词记录', 'success');
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
        showToast('\u5b66\u4e60\u96be\u5ea6\u5df2\u4fdd\u5b58\uff0c\u65b0\u96be\u5ea6\u9898\u5e93\u51c6\u5907\u4e2d\u2026', 'success');
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
    const { totalWords=0, masteredWords=0, pendingWords=0, totalTests=0, totalQuestions=0, correctCount=0, accuracyRate='0%', lastTestTime } = data;
    const pct = totalWords > 0 ? Math.round(masteredWords / totalWords * 100) : 0;
    const dash = 282.7 * pct / 100;

    $('statsContent').innerHTML = `
      <div class="progress-ring-wrap">
        <div class="progress-ring">
          <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
            <circle class="bg" cx="50" cy="50" r="45"/>
            <circle class="fg" cx="50" cy="50" r="45" style="stroke-dasharray:282.7;stroke-dashoffset:${282.7 - dash};"/>
          </svg>
          <div class="center">
            <div class="pct">${pct}%</div>
            <div class="pct-label">已掌握</div>
          </div>
        </div>
        <div class="ring-stats">
          <div class="ring-stat-item"><span><span class="dot" style="background:var(--orange);"></span>已掌握</span><strong>${escapeHtml(masteredWords)}</strong></div>
          <div class="ring-stat-item"><span><span class="dot" style="background:var(--text-muted);"></span>待复习</span><strong>${escapeHtml(pendingWords)}</strong></div>
          <div class="ring-stat-item"><span><span class="dot" style="background:var(--blue);"></span>总词汇</span><strong>${escapeHtml(totalWords)}</strong></div>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card orange">
          <div class="label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>考核次数</div>
          <div class="value">${escapeHtml(totalTests)}</div>
        </div>
        <div class="stat-card green">
          <div class="label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>正确率</div>
          <div class="value">${escapeHtml(accuracyRate)}</div>
          <div class="sub">${escapeHtml(correctCount)}/${escapeHtml(totalQuestions)}</div>
        </div>
      </div>
      ${lastTestTime ? `<div class="recent-test-note">上次考核：${escapeHtml(formatDate(lastTestTime))}</div>` : ''}
      ${DEV_MODE ? `<div class="cleanup-row"><button class="btn btn-outline btn-small cleanup-btn" onclick="showCleanupConfirm()">清理测试模式记录（${escapeHtml(user)}）</button></div>` : ''}
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
    await syncLearningSettingsFromServer(state.user);
    if (!(await ensureLevelCacheReadyForQuiz(state.user, state.level))) {
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
    navigateTo('quiz');
    renderQuestion(0);
  } catch(e) {
    showToast('生成题目失败: ' + normalizeApiError(e).message, 'error');
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
  const types = {1:'语境填空', 2:'英英释义', 3:'中英释义'};
  const typeClasses = {1:'type1', 2:'type2', 3:'type3'};
  const typeIcons = {1:'□', 2:'EN', 3:'中'};

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
  saveActiveReview();
  const canContinue = String(value || '').trim().length > 0;
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
    renderQuestion(state.currentQuestion);
  }
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
      data = await api(`/api/reviews/${encodeURIComponent(state.session.reviewId)}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          user: state.user,
          answers: state.answers.map((answer, i) => isMeaningReviewQuestion(state.quiz.questions[i])
            ? { text: String(answer ?? '').trim() }
            : { option: answer, confidence: state.confidences[i] })
        })
      });
    } else {
      data = await api('/api/submit', {
        method: 'POST',
        body: JSON.stringify({
          user: state.user,
          testId: state.quiz.testId,
          answers: state.answers.map((answer, i) => isMeaningReviewQuestion(state.quiz.questions[i])
            ? { text: String(answer ?? '').trim() }
            : { option: answer, confidence: state.confidences[i] })
        })
      });
    }
    state.quiz.result = data;

    if (state.session.kind === 'quiz') addGameRewardToBank(data.gameReward);
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
      const typeNames = {1:'语境填空', 2:'英英释义', 3:'中英释义'};

      // 构建完整题干展示
      let contextDisplay = '';
      let explanationHtml = '';

      if (q?.type === 1 && q?.context) {
        // Type 1: 显示上下文，空白处用 ___ 占位
        contextDisplay = escapeHtml(q.context).replace(/_____/g, '<span class="inline-blank">&nbsp;</span>');
      } else if (q?.type === 2 && q?.context) {
        contextDisplay = '📘 ' + escapeHtml(q.context);
      } else if (q?.type === 3 && q?.context) {
        contextDisplay = '🌐 ' + escapeHtml(q.context);
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
          if (isCorrect && isUserChoice) tag = '<span class="opt-tag tag-correct">✓ 正确答案</span>';
          else if (isCorrect) tag = '<span class="opt-tag tag-correct">✓ 正确答案</span>';
          else if (isUserChoice) tag = '<span class="opt-tag tag-wrong">你的选择</span>';
          return `<div class="${cls}">${escapeHtml(opt)} ${tag}</div>`;
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
            <span>${r.confidence === 'guess' ? '猜的 / 不确定：本题不计掌握证据' : '确定认识'}</span>
          </div>

          <div class="ctx-box">
            <div class="ctx-label">题干：</div>
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
    saveActiveReview();
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
    card.addEventListener('click', () => {
      alert('考核: ' + item.testId + '\n日期: ' + formatDate(item.time) + '\n得分: ' + item.correct + '/' + item.total + ' (' + pct + '%)');
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
