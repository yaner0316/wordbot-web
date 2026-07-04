const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const styles = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'styles.css'),
    'utf8'
);
const quizLogic = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'quiz-logic.js'),
    'utf8'
);
const reviewFlow = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'review-flow.js'),
    'utf8'
);
const preview = fs.readFileSync(path.join(__dirname, '..', 'preview.cjs'), 'utf8');
const rewardManifestPath = path.join(__dirname, '..', 'assets', 'reward-game', 'v1', 'manifest.json');
const rewardManifest = fs.existsSync(rewardManifestPath)
    ? fs.readFileSync(rewardManifestPath, 'utf8')
    : '';
const rewardPlaceholderCharacterPath = path.join(__dirname, '..', 'assets', 'reward-game', 'v1', 'placeholders', 'character.svg');
const rewardPlaceholderHabitatPath = path.join(__dirname, '..', 'assets', 'reward-game', 'v1', 'placeholders', 'habitat.svg');
const rewardPlaceholderCharacter = fs.existsSync(rewardPlaceholderCharacterPath)
    ? fs.readFileSync(rewardPlaceholderCharacterPath, 'utf8')
    : '';
const rewardPlaceholderHabitat = fs.existsSync(rewardPlaceholderHabitatPath)
    ? fs.readFileSync(rewardPlaceholderHabitatPath, 'utf8')
    : '';

test('frontend assets are loaded from focused external files', () => {
    assert.match(html, /<link rel="stylesheet" href="src\/styles\.css"\s*\/?>/);
    assert.match(html, /<script src="src\/quiz-logic\.js"><\/script>/);
    assert.match(html, /<script src="src\/review-flow\.js"><\/script>/);
    assert.match(html, /<script src="config\.js"><\/script>/);
    assert.match(html, /<script src="src\/app\.js"><\/script>/);
    assert.doesNotMatch(html, /<style>/);
    assert.doesNotMatch(html, /<script>\s*\/\/ ========== State/);
});

test('deployed frontend can point API calls at the Render backend', () => {
    const config = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');

    assert.match(config, /wordbot-1-w9il\.onrender\.com/);
    assert.match(app, /WORDBOT_CONFIG\?\.API_BASE/);
    assert.match(app, /replace\(\/\\\/\$\/,\s*''\)/);
});

test('wrong-answer review is offered only after answer analysis', () => {
    assert.match(reviewFlow, /analysisViewed/);
    assert.ok(app.includes('\u5f00\u59cb\u9519\u9898\u590d\u4e60'));
    assert.ok(app.includes('\u67e5\u770b\u7b54\u6848\u89e3\u6790'));
    assert.ok(app.includes('\u7ee7\u7eed\u590d\u4e60'));
    assert.ok(app.includes('\u4e0b\u6b21\u590d\u4e60'));
    assert.match(app, /state\.session\.firstResult\s*=\s*data/);
    assert.match(app, /wordbot:active-review:/);
    assert.match(app, /restoreActiveReview/);
});

test('difficulty preference is stored per user and defaults to middle school', () => {
    assert.match(app, /DEFAULT_LEVEL\s*=/);
    assert.match(app, /wordbot:difficulty:/);
    assert.match(app, /localStorage\.getItem/);
    assert.match(app, /localStorage\.setItem/);
});

test('middle school is displayed as junior high while keeping the cache key stable', () => {
    const middleLevel = String.fromCharCode(0x4e2d, 0x5b66);
    const juniorLevel = String.fromCharCode(0x521d, 0x4e2d);
    assert.ok(app.includes(`const DEFAULT_LEVEL = '${middleLevel}'`));
    assert.ok(app.includes(`const LEVEL_LABELS = { '${middleLevel}': '${juniorLevel}' };`));
    assert.match(app, /function formatLearningLevel\(level\)/);
    assert.ok(html.includes(`id="currentLevelText">${juniorLevel}<`));
    assert.match(app, /value="\$\{level\}"[\s\S]*formatLearningLevel\(level\)/);
    assert.doesNotMatch(app, /body: JSON\.stringify\(\{ userId: state\.user, learningLevel: formatLearningLevel/);
});

test('demo quiz generation applies the selected question-language level', () => {
    assert.match(app, /function generateDemoQuiz\(level\)/);
    assert.match(quizLogic, /function adaptDemoContextByLevel/);
    assert.match(app, /generateDemoQuiz\(state\.level\)/);
});

test('demo fill-in questions neutralize a or an before the blank', () => {
    assert.match(quizLogic, /function normalizeArticleContext/);
    assert.match(quizLogic, /replace\(\/\\ban\\s\+_____\/gi,\s*'a\(n\) _____'\)/);
    assert.match(app, /context = normalizeArticleContext\(context\)/);
});

test('home shows current learning level without student level buttons', () => {
    assert.match(html, /id="currentLevelText"/);
    assert.ok(html.includes('当前难度'));
    const start = html.indexOf('<div class="learning-level-badge"');
    const end = html.indexOf('<div id="statsContent"', start);
    assert.ok(start >= 0 && end > start, 'home current level badge should exist before stats content');
    const homeLevelBlock = html.slice(start, end);
    assert.doesNotMatch(homeLevelBlock, /data-level=/);
    assert.doesNotMatch(homeLevelBlock, /onclick="selectLevel/);
});

test('quiz requests include the explicit real or test assessment mode', () => {
    assert.match(app, /mode:\s*state\.mode/);
    assert.match(html + app, /selectMode/);
    assert.match(html, /data-mode="test"/);
});

test('demo mode is enabled only through an explicit query parameter', () => {
    assert.match(app, /get\('demo'\)\s*===\s*'1'/);
    assert.doesNotMatch(app, /Demo mode fallback/);
    assert.doesNotMatch(app, /getDemoHistory\(\)/);
});

test('api helper rejects non-success HTTP responses', () => {
    assert.match(app, /if\s*\(!response\.ok\)/);
    assert.match(app, /error\.code\s*=\s*data\.code/);
});

test('current user card keeps logout in the single global header action', () => {
    assert.match(app, /card\.append\(avatar, text\);/);
    assert.doesNotMatch(app, /logoutButton/);
    assert.doesNotMatch(html, /onclick="selectUser\('\$\{u\}'\)"/);
});

test('quiz generation always clears the loading overlay', () => {
    assert.match(
        app,
        /async function startQuiz\(\)[\s\S]*finally\s*\{\s*hideLoading\(\);\s*\}/
    );
});

test('quiz option labels use display formatting without changing answer indexes', () => {
    assert.match(app, /formatOptionDisplayText/);
    assert.ok(app.includes("formatOptionDisplayText(opt.replace(/^[A-D]\\.\\s*/, ''), q.options)"));
    assert.match(app, /selectOption\(\$\{idx\}, \$\{i\}\)/);
});
test('quiz answers default to sure confidence but can be changed to guess', () => {
    assert.ok(app.includes('confidences: []'));
    assert.ok(app.includes('function selectOption(qIdx, optIdx)'));
    assert.match(app, /if \(state\.confidences\[qIdx\] === null\)\s*\{\s*state\.confidences\[qIdx\] = 'sure';\s*\}/);
    assert.ok(app.includes('function selectConfidence(qIdx, confidence)'));
    assert.ok(app.includes('confidence: state.confidences[i]'));
    assert.ok(app.includes('function canLeaveCurrentQuestion()'));
    assert.ok(app.includes("$('nextBtn').disabled = !canContinue;"));
    assert.ok(app.includes("$('submitBtn').disabled = !canContinue;"));
});

test('answer analysis explains the concrete question and compares a wrong choice', () => {
    assert.match(quizLogic, /function buildQuestionExplanation/);
    assert.match(quizLogic, /replace\(\/_____\/g,\s*correctWord\)/);
});

test('answer analysis lists Chinese meanings for all options before the reasoning', () => {
    assert.match(quizLogic, /function buildOptionMeaningsExplanation/);
    assert.match(quizLogic, /question\.optionMeanings/);
    assert.match(
        app,
        /buildOptionMeaningsExplanation\(q,\s*escapeHtml\)[\s\S]*buildQuestionExplanation\(q,\s*r,\s*escapeHtml\)/
    );
});


test('review result analysis uses Chinese meaning feedback instead of option analysis', () => {
    assert.match(app, /buildMeaningReviewExplanation\(q,\s*r,\s*escapeHtml\)/);
    assert.match(app, /isMeaningReviewQuestion\(q\)/);
});

test('history detail exposes the saved questions and answers', () => {
    assert.match(app, /openHistoryDetail\(item\)/);
    assert.match(app, /查看题目/);
    assert.match(app, /孩子答案/);
    assert.match(app, /正确答案/);
});

test('the last question shows only one submit action', () => {
    assert.match(app, /const isLastQuestion = idx === total - 1/);
    assert.match(app, /nextBtn'\)\.style\.display\s*=\s*isLastQuestion \? 'none' : 'flex'/);
    assert.match(app, /submitBtn'\)\.style\.display\s*=\s*isLastQuestion \? 'flex' : 'none'/);
});

test('quiz results can show game time rewards', () => {
    assert.match(app, /function calculateDemoGameReward/);
    assert.match(app, /gameReward:\s*calculateDemoGameReward/);
    assert.match(app, /game-reward-card/);
    assert.match(styles, /\.game-reward-card/);
});

test('home page gates parent tools behind phone password access', () => {
    assert.match(html, /id="parentConsoleEntry"/);
    assert.match(html, /id="parentGatePanel"/);
    assert.match(html, /id="parentToolGrid"[\s\S]*style="display:none/);
    assert.match(app, /function openParentConsole/);
    assert.match(html, /id="parentPasswordInput"/);
    assert.match(app, /function verifyParentPassword/);
    assert.match(app, /\/api\/auth\/login/);
    assert.match(app, /ensureParentAccess/);
    assert.match(app, /function submitParentWords/);
    assert.match(app, /\/api\/admin\/addWords/);
    assert.match(app, /\/api\/admin\/userSettings/);
});

test('home load skips the unused all-users request for faster startup', () => {
    const loadHomeMatch = app.match(/async function loadHome\(\) \{[\s\S]*?\n\}/);
    assert.ok(loadHomeMatch, 'loadHome function should exist');
    assert.doesNotMatch(loadHomeMatch[0], /\/api\/admin\/users/);
    assert.match(loadHomeMatch[0], /loadStats\(state\.user\)/);
});

test('learning settings save asks the backend to keep rebuilding automatically', () => {
    const start = app.indexOf('async function saveParentLearningSettings()');
    const end = app.indexOf('async function rebuildParentQuestionCache()', start);
    assert.ok(start >= 0 && end > start, 'saveParentLearningSettings function should exist');
    const saveSettingsSource = app.slice(start, end);
    assert.match(saveSettingsSource, /questionCacheStatus\s*===\s*'building'/);
    assert.match(saveSettingsSource, /requestQuestionCacheRebuild\(state\.user\)/);
});

test('learning settings save refreshes cache status after background rebuild starts', () => {
    const saveSettingsMatch = app.match(/async function saveParentLearningSettings\(\) \{[\s\S]*?\n\}/);
    assert.ok(saveSettingsMatch, 'saveParentLearningSettings function should exist');
    assert.match(saveSettingsMatch[0], /questionCacheStatus\s*===\s*'building'/);
    assert.match(saveSettingsMatch[0], /loadParentLearningSettings\(\)/);
});

test('learning settings save keeps the API response in scope for state sync', () => {
    const start = app.indexOf('async function saveParentLearningSettings()');
    const end = app.indexOf('async function rebuildParentQuestionCache()', start);
    assert.ok(start >= 0 && end > start, 'saveParentLearningSettings function should exist');
    const saveSettingsSource = app.slice(start, end);
    assert.match(saveSettingsSource, /let\s+data\s*=/);
    assert.doesNotMatch(saveSettingsSource, /if\s*\(!DEMO_MODE\)\s*\{[\s\S]*const\s+data\s*=/);
    assert.match(saveSettingsSource, /state\.learningSettings\s*=\s*data\?\.settings/);
});

test('frontend syncs learning level from server settings after login and user switch', () => {
    assert.match(app, /async function syncLearningSettingsFromServer\(user/);
    assert.match(app, /\/api\/admin\/userSettings\?userId=/);
    assert.match(app, /state\.learningSettings\s*=\s*settings/);
    assert.match(app, /state\.level\s*=\s*settings\.learningLevel/);
    assert.match(app, /syncLearningSettingsFromServer\(user\)\.finally\(\(\) => loadHome\(\)\)/);
    assert.match(app, /syncLearningSettingsFromServer\(user\)\.finally\(\(\) => \{ renderStudentTools\(\); loadStats\(user\); \}\)/);
});

test('learning level changes are saved only from parent settings', () => {
    assert.doesNotMatch(html, /onclick="selectLevel/);
    assert.doesNotMatch(html, /data-level=/);
    assert.doesNotMatch(app, /async function selectLevel/);
    const start = app.indexOf('async function saveParentLearningSettings()');
    const end = app.indexOf('async function rebuildParentQuestionCache()', start);
    assert.ok(start >= 0 && end > start, 'saveParentLearningSettings function should exist');
    const saveSettingsSource = app.slice(start, end);
    assert.ok(saveSettingsSource.includes('/api/admin/userSettings'));
    assert.ok(saveSettingsSource.includes("method: 'PUT'"));
    assert.ok(saveSettingsSource.includes("questionCacheStatus === 'building'"));
});

test('quiz cache-not-ready response triggers rebuild without serial preflight', () => {
    const startQuizMatch = app.match(/async function startQuiz\(\) \{[\s\S]*?function isMeaningReviewQuestion/);
    assert.ok(startQuizMatch, 'startQuiz function should exist');
    assert.match(app, /function requestQuestionCacheRebuild\(user\)/);
    assert.match(app, /questionCache\/rebuild/);
    assert.match(app, /error\.diagnostics\s*=\s*data\.diagnostics/);
    assert.match(startQuizMatch[0], /e\.code\s*===\s*'QUESTION_CACHE_NOT_READY'/);
    assert.match(startQuizMatch[0], /requestQuestionCacheRebuild\(state\.user\)/);
    assert.match(startQuizMatch[0], /readyCount/);
    assert.doesNotMatch(startQuizMatch[0], /ensureLevelCacheReadyForQuiz\(state\.user/);
    assert.match(startQuizMatch[0], /data\.level\s*===\s*state\.level\s*&&\s*data\.difficultyApplied\s*===\s*false/);
});

test('quiz results can show animal garden reward summary from submit response', () => {
    assert.match(app, /function buildAnimalGardenRewardHtml/);
    assert.match(app, /data\.rewardSummary/);
    assert.match(app, /animal-garden-card/);
    assert.match(styles, /\.animal-garden-card/);
});

test('game reward minutes are banked and offered after at least one review round', () => {
    assert.match(app, /GAME_TIME_BANK_KEY_PREFIX/);
    assert.match(app, /function addGameRewardToBank/);
    assert.match(app, /GAME_TIME_REWARD_CLAIM_KEY_PREFIX/);
    assert.match(app, /function getClaimedGameRewardIds/);
    assert.match(app, /function markGameRewardClaimed/);
    assert.match(app, /addGameRewardToBank\(data\.gameReward, state\.user, state\.quiz\?\.testId \|\| data\.testId\)/);
    assert.match(app, /function getBankedGameMinutes/);
    assert.match(app, /function renderGameTimePrompt/);
    assert.match(app, /state\.session\.reviewRounds\.length\s*>\s*0/);
    assert.match(app, /\u73b0\u5728\u73a9/);
    assert.match(app, /\u4e0b\u6b21\u73a9/);
    assert.match(app, /\u5b58\u7559\u65f6\u95f4/);
});

test('perfect quiz game reward is twelve minutes and excellent is five', () => {
    assert.match(app, /minutes:\s*12[\s\S]*tier:\s*'perfect'/);
    assert.match(app, /minutes:\s*5[\s\S]*tier:\s*'excellent'/);
});

test('banked game time opens a playable animal garden mini game', () => {
    assert.match(app, /function renderAnimalGardenGame/);
    assert.match(app, /function playAnimalGardenAction/);
    assert.match(app, /function closeAnimalGardenGame/);
    assert.match(app, /animal-garden-game/);
    assert.match(styles, /\.animal-garden-game/);
});

test('animal garden rewards render through manifest-driven art assets', () => {
    assert.match(app, /REWARD_GAME_ASSET_MANIFEST/);
    assert.match(app, /function renderGardenMeters/);
    assert.match(app, /function renderGardenInventory/);
    assert.match(app, /function renderGardenWardrobe/);
    assert.match(app, /function mountCurrentRewardGardenArt/);
    assert.match(app, /garden-meters/);
    assert.match(app, /garden-inventory/);
    assert.match(app, /garden-art-stage/);
    assert.match(app, /garden-art-character/);
    assert.match(app, /garden-art-equipment/);
    assert.ok(app.includes('assets/reward-game/v1/manifest.json'));
    assert.match(styles, /\.garden-meter-card/);
    assert.match(styles, /\.garden-inventory-item/);
    assert.match(styles, /\.garden-art-stage/);
    assert.match(styles, /\.garden-art-character/);
    assert.match(styles, /\.garden-art-equipment/);
    assert.doesNotMatch(app, /animal-visitor-row/);
    assert.doesNotMatch(app, /animal-visitor-chip/);
});

test('home does not expose mini game preview or data mode controls', () => {
    const homeStart = html.indexOf('id="pageHome"');
    const homeEnd = html.indexOf('id="pageQuiz"', homeStart);
    assert.ok(homeStart >= 0 && homeEnd > homeStart, 'home page markup should exist');
    const homeHtml = html.slice(homeStart, homeEnd);
    assert.doesNotMatch(homeHtml, /gamePreviewBtn/);
    assert.doesNotMatch(homeHtml, /modeSelectorWrap/);
    assert.doesNotMatch(homeHtml, /data-mode="test"/);
    assert.doesNotMatch(homeHtml, /\u5c0f\u6e38\u620f\u4f53\u9a8c/);
    assert.match(app, /function startGamePreview/);
});

test('unregistered legacy users are guided into first password binding', () => {
    assert.match(app, /function handleUnregisteredPasswordLogin/);
    assert.match(app, /updateAuthMode\('register'\)/);
    assert.match(app, /authPasswordConfirm\.value\s*=\s*authPassword\.value/);
    assert.ok(app.includes('user has no password yet'));
    assert.ok(app.includes('\u9996\u6b21\u4f7f\u7528\u8bf7\u518d\u70b9\u4e00\u6b21\u6ce8\u518c\u5e76\u767b\u5f55'));
});

test('auth uses server-side password endpoints instead of browser-only users', () => {
    assert.match(app, /\/api\/auth\/login/);
    assert.match(app, /\/api\/auth\/register/);
    assert.ok(!app.includes('\u7528\u6237\u4e0d\u5b58\u5728\uff0c\u53ef\u4ee5\u5148\u6ce8\u518c'));
});

test('animal garden care action triggers manifest reward drops', () => {
    assert.match(app, /lastAction:\s*action/);
    assert.match(app, /mountCurrentRewardGardenArt/);
    assert.match(app, /garden-art-drop/);
    assert.match(app, /intimacyStar/);
    assert.match(app, /feedCarrot/);
    assert.match(app, /wordCrystal/);
});

test('main frontend strings do not leak mojibake or broken template fragments', () => {
    const brokenTextPattern = /鐎圭鐎电殬闁圭憢闁肩殬婵絸妫ｅ剟闁哄被鍎冲﹢鍘婄紓浣堝懐鏁緗濞戞挸顑唡鐎?|闁汇垻鍠恷閻犲洤鍢瞸缂?|濡絾鐗梶濞ｅ洦绻傞悺鈻呭鎯扮簿鐟欘洟閻庢冻缂氱弧鍓曢柨娉戦柕鍞￠柍顨傞柎浜匼?\/div|\?\/span|\?\{escapeHtml|\?\{formatDate/;
    assert.doesNotMatch(app, brokenTextPattern);
});

test('home stats and game prompts render clean Chinese text', () => {
    assert.ok(app.includes("const DEFAULT_LEVEL = '\u4e2d\u5b66'"));
    assert.ok(app.includes('\u5df2\u638c\u63e1'));
    assert.ok(app.includes('\u5de9\u56fa\u4e2d'));
    assert.ok(app.includes('\u5df2\u8ba4\u8bc6'));
    assert.ok(app.includes('\u672a\u5f00\u59cb'));
    assert.ok(app.includes('\u603b\u8bcd\u6c47'));
    assert.ok(app.includes('\u8003\u6838\u6b21\u6570'));
    assert.ok(app.includes('\u6b63\u786e\u7387'));
    assert.ok(app.includes('\u4e0a\u6b21\u8003\u6838'));
    assert.ok(app.includes('\u5c0f\u6e38\u620f\u65f6\u95f4'));
    assert.ok(app.includes('\u5b58\u7559\u65f6\u95f4'));
    assert.ok(app.includes('\u73b0\u5728\u73a9'));
    assert.ok(app.includes('\u4e0b\u6b21\u73a9'));
    assert.doesNotMatch(app, /鐎圭寮剁敮澶愬箵|鐎垫澘鎳巪闁诡剚妲掗惁娼€闁兼澘鍟悧纭樻慨婵撶悼|妫ｅ啯娅渱妫ｅ啯顥攟\?\{formatDate|\?\{escapeHtml\(user\)/);
});

test('animal garden art manifest defines replaceable production asset slots', () => {
    assert.match(rewardManifest, /"version"\s*:\s*"v1"/);
    assert.match(rewardManifest, /"styleName"\s*:\s*"storybook-soft-2.5d"/);
    assert.match(rewardManifest, /"wordDragon"/);
    assert.match(rewardManifest, /"stage01"/);
    assert.ok(rewardManifest.includes('"idle": "assets/reward-game/v1/characters/word-dragon/stage-01/idle.svg"'));
    assert.match(rewardManifest, /"starSatchel"/);
    assert.match(rewardManifest, /"meadowDay"/);
    assert.match(rewardManifest, /"intimacyStar"/);
});

test('local preview serves reward manifest and svg assets with explicit content types', () => {
    assert.match(preview, /'\.json': 'application\/json; charset=utf-8'/);
    assert.match(preview, /'\.svg': 'image\/svg\+xml; charset=utf-8'/);
});

test('animal garden placeholder art assets are clean svg stand-ins', () => {
    assert.match(rewardPlaceholderCharacter, /<svg/);
    assert.match(rewardPlaceholderCharacter, /word-dragon-placeholder/);
    assert.match(rewardPlaceholderCharacter, /#FF9C58/);
    assert.match(rewardPlaceholderHabitat, /<svg/);
    assert.match(rewardPlaceholderHabitat, /habitat-placeholder/);
    assert.match(rewardPlaceholderHabitat, /#D8F0FF/);
});

test('animal garden v0.3 keeps polished meters with manifest art stage', () => {
    assert.match(app, /function getGardenLevel/);
    assert.match(app, /function renderGardenMeters/);
    assert.match(app, /function renderGardenInventory/);
    assert.match(app, /function renderGardenWardrobe/);
    assert.match(app, /id="animalGardenArtStage"/);
    assert.match(app, /data-outfit=/);
    assert.match(styles, /\.garden-meter-fill/);
    assert.match(styles, /\.garden-wardrobe/);
    assert.match(styles, /\.garden-stage-overlay/);
    assert.match(styles, /\.garden-art-fallback/);
    assert.doesNotMatch(styles, /\.equipment-scarf[\s\S]*bottom:\s*18px/);
});


test('home shows the Xiaolong character image as a first-screen mascot', () => {
    assert.match(html, /assets\/xiaolong(?:-transparent)?\.png/);
    assert.match(html, /class="home-dragon"/);
    assert.match(styles, /\.home-dragon/);
    assert.match(styles, /\.home-hero-strip/);
});

test('home quick actions show only study entries and continue only when a draft exists', () => {
    const start = app.indexOf('function renderStudentTools()');
    const end = app.indexOf('function openStudentWordEntry()', start);
    assert.ok(start >= 0 && end > start, 'renderStudentTools function should exist');
    const renderStudentToolsSource = app.slice(start, end);
    assert.match(renderStudentToolsSource, /const hasDraft = hasActiveQuizDraft\(state\.user\)/);
    assert.match(renderStudentToolsSource, /hasDraft \? `[\s\S]*quick-action-continue/);
    assert.match(renderStudentToolsSource, /\.filter\(Boolean\)\.join\(''\)/);
    assert.match(renderStudentToolsSource, /openStudentWordEntry\(\)/);
    assert.ok(renderStudentToolsSource.includes("navigateTo(\\'history\\')"));
    assert.doesNotMatch(renderStudentToolsSource, /quick-action-disabled/);
    assert.doesNotMatch(renderStudentToolsSource, /renderBankedGameTimeCard\(\)/);
    assert.doesNotMatch(renderStudentToolsSource, /已存游戏时间|小游戏体验|数据模式|清理测试模式记录/);
    assert.match(app, /function handleContinueQuizEntry\(\)/);
    assert.match(app, /restoreQuizDraft\(\)/);
});

test('current learning level is shown as a parent-managed compact badge', () => {
    assert.match(html, /class="learning-level-badge"/);
    assert.match(html, /id="currentLevelText"/);
    assert.match(styles, /\.learning-level-badge/);
    assert.doesNotMatch(html, /class="current-level-display"/);
});

test('product name is Xiaolong Plays Words', () => {
    assert.ok(html.includes('\\u5c0f\\u9f99\\u620f\\u5355\\u8bcd') || html.includes('小龙戏单词'));
    assert.ok(!html.includes('\\u5355\\u8bcd\\u673a\\u5668\\u4eba') && !html.includes('单词机器人'));
});
test('wrong-answer review supports Chinese meaning typed answers', () => {
    assert.match(app, /function isMeaningReviewQuestion/);
    assert.match(app, /answerMode\s*===\s*'cn_meaning'/);
    assert.match(app, /text:\s*String\(answer \?\? ''\)\.trim\(\)/);
    assert.match(app, /class="meaning-answer-input"/);
});


test('quiz diagnostics are kept out of the child quiz flow and shown in parent settings', () => {
    assert.match(app, /quizDiagnostics:\s*null/);
    assert.match(app, /state\.quizDiagnostics\s*=\s*buildQuizDiagnosticsSummary\(data\)/);
    assert.match(app, /function renderQuizDiagnosticsPanel/);
    assert.match(app, /parentSettingsContent/);
    assert.match(app, /本次出题来源/);
    assert.doesNotMatch(app, /id="questionArea"[\s\S]{0,3000}quizDiagnostics/);
});

test('student auth uses username and password without phone or OTP login', () => {
    assert.doesNotMatch(html, /authOtpMethod/);
    assert.doesNotMatch(html, /authPhoneWrap/);
    assert.doesNotMatch(app, /requestLoginOtp/);
    assert.ok(!app.includes('/api/auth/otpLogin'));
    assert.ok(!app.includes('/api/auth/requestOtp'));
});

test('parent console uses child-scoped parent username and password', () => {
    assert.match(html, /parentUsernameInput/);
    assert.match(app, /verifyParentPassword/);
    assert.ok(app.includes('/api/auth/parent/login'));
    assert.ok(!app.includes('/api/auth/parentOtp'));
});
test('parent console can reset the current child password after parent login', () => {
    assert.ok(app.includes('\u91cd\u7f6e\u5b69\u5b50\u5bc6\u7801'));
    assert.match(app, /openParentTool\('resetChildPassword'\)/);
    assert.match(app, /function resetChildPassword/);
    assert.ok(app.includes('/api/auth/parent/reset-child-password'));
    assert.doesNotMatch(app, /resetChildPassword[\s\S]*\/api\/auth\/requestOtp/);
});
test('browser back stays inside the app and preserves in-progress quizzes', () => {
    assert.match(app, /function initializeAppHistory/);
    assert.match(app, /window\.addEventListener\('popstate',\s*handleBrowserBack/);
    assert.match(app, /function handleBrowserBack/);
    assert.match(app, /function handleInAppBack/);
    assert.match(app, /saveCurrentSessionProgress\(\)/);
    assert.match(app, /navigateTo\('home',\s*\{\s*replace:\s*true/);
    assert.match(app, /history\.pushState/);
    assert.match(app, /history\.replaceState/);
});

test('backspace only navigates normally inside editable fields', () => {
    assert.match(app, /function isEditableTarget/);
    assert.match(app, /function handleGlobalKeydown/);
    assert.match(app, /event\.key === 'Backspace'/);
    assert.match(app, /event\.preventDefault\(\)/);
    assert.match(app, /window\.addEventListener\('keydown',\s*handleGlobalKeydown/);
});

test('quiz start relies on quiz diagnostics instead of serial cache preflight', () => {
    const start = app.indexOf('async function startQuiz()');
    const end = app.indexOf('function isMeaningReviewQuestion', start);
    assert.ok(start >= 0 && end > start, 'startQuiz function should exist');
    const startQuizSource = app.slice(start, end);
    assert.match(startQuizSource, /\/api\/quiz/);
    assert.match(startQuizSource, /state\.quizDiagnostics\s*=\s*buildQuizDiagnosticsSummary\(data\)/);
    assert.doesNotMatch(startQuizSource, /await syncLearningSettingsFromServer\(state\.user/);
    assert.doesNotMatch(startQuizSource, /ensureLevelCacheReadyForQuiz\(state\.user/);
});
test('quiz submit automatically confirms the result once after a timeout', () => {
    assert.match(app, /async function submitQuizToBackend/);
    assert.match(app, /error\?\.name\s*===\s*'AbortError'/);
    assert.match(app, /提交时间较长，正在确认结果/);
    const submitSource = app.slice(app.indexOf('async function submitQuiz()'), app.indexOf('// ========== Results =========='));
    assert.match(submitSource, /submitQuizToBackend\(payload\)/);
    assert.doesNotMatch(submitSource, /timeoutMs:\s*90000/);
});
test('word entry supports duplicate confirmation before adding same-word meanings', () => {
    assert.match(app, /function parseParentWordEntries/);
    assert.match(app, /promotion \| 促销活动/);
    assert.match(app, /DUPLICATE_WORD_CONFIRMATION_REQUIRED/);
    assert.match(app, /confirmNewMeanings/);
    assert.match(app, /skipDuplicateWords/);
    assert.match(app, /function renderDuplicateWordConfirmation/);
    assert.match(app, /error\.payload\s*=\s*data/);
});


test('parent word query and library editing are separate tools with Chinese status labels', () => {
    assert.match(app, /openParentTool\('queryWord'\)/);
    assert.match(app, /openParentTool\('editWords'\)/);
    assert.match(app, /function loadParentWordLibrary/);
    assert.match(app, /function renderParentWordLibrary/);
    assert.match(app, /function saveParentWordStatus/);
    assert.match(app, /\/api\/admin\/words\?userId=/);
    assert.match(app, /STATUS_LABELS/);
    assert.match(app, /待学习/);
    assert.match(app, /已掌握/);
    const searchStart = app.indexOf('async function searchParentWord()');
    const searchEnd = app.indexOf('async function loadParentWordLibrary', searchStart);
    assert.ok(searchStart >= 0 && searchEnd > searchStart, 'searchParentWord should appear before library editor');
    const searchSource = app.slice(searchStart, searchEnd);
    assert.doesNotMatch(searchSource, /parent-word-editor/);
    assert.doesNotMatch(searchSource, /saveParentWord/);
});

test('parent console omits word entry because students add words from home', () => {
    const htmlGridStart = html.indexOf('id="parentToolGrid"');
    const htmlGridEnd = html.indexOf('<div class="parent-tool-panel"', htmlGridStart);
    assert.ok(htmlGridStart >= 0 && htmlGridEnd > htmlGridStart, 'static parent tool grid should exist');
    const htmlGrid = html.slice(htmlGridStart, htmlGridEnd);
    assert.ok(!htmlGrid.includes("openParentTool('addWords')"));
    assert.ok(htmlGrid.includes("openParentTool('queryWord')"));
    assert.ok(htmlGrid.includes("openParentTool('editWords')"));

    const ensureStart = app.indexOf('function ensureParentPage()');
    const ensureEnd = app.indexOf('function getParentToolPanel()', ensureStart);
    assert.ok(ensureStart >= 0 && ensureEnd > ensureStart, 'dynamic parent page should exist');
    const ensureSource = app.slice(ensureStart, ensureEnd);
    assert.ok(!ensureSource.includes("openParentTool('addWords')"));
    assert.ok(ensureSource.includes("openParentTool('queryWord')"));
    assert.ok(ensureSource.includes("openParentTool('editWords')"));
});

test('home quick actions exclude banked game time entry', () => {
    assert.doesNotMatch(app, /function renderBankedGameTimeCard/);
    assert.doesNotMatch(app, /function handleBankedGameTimeEntry/);
    assert.doesNotMatch(app, /已存游戏时间/);
    assert.match(app, /function getBankedGameMinutes/);
    assert.match(app, /function renderAnimalGardenGame/);
});
