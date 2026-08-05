const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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

function extractNamedFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} function should exist`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Could not extract ${name}`);
}

function loadQuizReadinessHelpers() {
    const context = { state: { level: '\u4e2d\u5b66' } };
    vm.createContext(context);
    vm.runInContext([
        extractNamedFunction(app, 'getLevelCacheStatus'),
        extractNamedFunction(app, 'getLevelCacheReadyCount'),
        extractNamedFunction(app, 'getQuizCacheReadiness'),
    ].join('\n'), context);
    return context;
}

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
    assert.ok(app.includes("formatOptionDisplayText(opt.replace(/^[A-D]\\.\\s*/, ''), q.options, q)"));
    assert.match(app, /selectOption\(\$\{idx\}, \$\{i\}\)/);
});

test('result review option labels use the same display formatting as quiz options', () => {
    const start = app.indexOf('function renderResults(data)');
    const end = app.indexOf('function toggleAnalysis()', start);
    assert.ok(start >= 0 && end > start, 'renderResults function should exist');
    const renderResultsSource = app.slice(start, end);

    assert.match(renderResultsSource, /formatOptionDisplayText/);
    assert.doesNotMatch(renderResultsSource, /return `<div class="\$\{cls\}">\$\{escapeHtml\(opt\)\}/);
});
test('quiz answers can continue after selecting an option', () => {
    const removedState = ['confi', 'dences'].join('');
    const removedHandler = ['select', 'Confi', 'dence'].join('');
    const removedPayload = ['confi', 'dence:\\s*state\\.confi', 'dences\\[i\\]'].join('');

    assert.ok(app.includes('function selectOption(qIdx, optIdx)'));
    assert.doesNotMatch(app, new RegExp(removedState));
    assert.doesNotMatch(app, new RegExp(removedHandler));
    assert.doesNotMatch(app, new RegExp(removedPayload));
    assert.ok(app.includes('function canLeaveCurrentQuestion()'));
    assert.ok(app.includes("$('nextBtn').disabled = !canContinue;"));
    assert.ok(app.includes("$('submitBtn').disabled = !canContinue;"));
});

test('answer analysis explains the concrete question and compares a wrong choice', () => {
    assert.match(quizLogic, /function buildQuestionExplanation/);
    assert.match(quizLogic, /const correctWord = optionWord\(question, question\.answer\)/);
    assert.match(quizLogic, /const selectedWord = optionWord\(question, result\.your\)/);
    assert.match(quizLogic, /与本题给出的语境或释义不匹配/);
});

test('ordinary results use only the stored context translation in the correct option', () => {
    const start = app.indexOf('function renderResults(data)');
    const end = app.indexOf('function toggleAnalysis()', start);
    assert.ok(start >= 0 && end > start, 'renderResults function should exist');
    const renderResultsSource = app.slice(start, end);
    assert.match(quizLogic, /function buildContextTranslationHtml/);
    assert.match(renderResultsSource, /const translationHtml = isCorrect\s*\?\s*buildContextTranslationHtml\(q,\s*escapeHtml\)\s*:\s*'';/);
    assert.doesNotMatch(renderResultsSource, /buildOptionMeaningsExplanation\(q,\s*escapeHtml\)/);
    assert.doesNotMatch(renderResultsSource, /buildQuestionExplanation\(q,\s*r,\s*escapeHtml\)/);
    assert.match(renderResultsSource, /\$\{isMeaningReview \? `<div class="explain-box">/);
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

test('quiz page has a header-aligned return home action', () => {
    const quizStart = html.indexOf('id="pageQuiz"');
    const quizEnd = html.indexOf('id="pageResults"', quizStart);
    assert.ok(quizStart >= 0 && quizEnd > quizStart, 'quiz page markup should exist');
    const quizHtml = html.slice(quizStart, quizEnd);
    assert.match(quizHtml, /class="quiz-header-row"/);
    assert.match(quizHtml, /class="quiz-home-btn"/);
    assert.match(quizHtml, /onclick="navigateTo\('home'\)"/);
    assert.match(quizHtml, /\u8fd4\u56de\u9996\u9875/);
    assert.match(styles, /\.quiz-header-row/);
    assert.match(styles, /\.quiz-home-btn/);
});

test('parent auth explains child-scoped credentials on generic backend failure', () => {
    assert.match(app, /function formatParentLoginError/);
    assert.match(app, /formatParentLoginError\(error\)/);
    assert.ok(app.includes('\u5f53\u524d\u5b69\u5b50'));
    assert.ok(app.includes('\u7ed1\u5b9a\u7684\u5bb6\u957f\u7528\u6237\u540d\u6216\u5bc6\u7801\u4e0d\u5bf9'));
});
test('home load skips the unused all-users request for faster startup', () => {
    const loadHomeMatch = app.match(/async function loadHome\(\) \{[\s\S]*?\n\}/);
    assert.ok(loadHomeMatch, 'loadHome function should exist');
    assert.doesNotMatch(loadHomeMatch[0], /\/api\/admin\/users/);
    assert.match(loadHomeMatch[0], /loadStats\(state\.user,\s*\{\s*showOverlay:\s*false\s*\}\)/);
});

test('login home becomes interactive before stats, cache, and session finish loading', () => {
    const loginSource = extractNamedFunction(app, 'loginAs');
    const homeSource = extractNamedFunction(app, 'loadHome');

    assert.doesNotMatch(homeSource, /showLoading\(/);
    assert.match(homeSource, /loadStats\(state\.user,\s*\{\s*showOverlay:\s*false\s*\}\)/);
    assert.match(homeSource, /loadQuizCacheReadiness\(state\.user\)/);
    assert.match(homeSource, /loadRemoteQuizSession\(state\.user\)/);
    assert.match(loginSource, /showAppPage\(\);[\s\S]*loadHome\(\)/);
    assert.doesNotMatch(loginSource, /await\s+loadHome\(/);
});

test('loadStats keeps the full-screen loading overlay by default', () => {
    const statsStart = app.indexOf('async function loadStats');
    const statsSource = app.slice(statsStart, app.indexOf('// ========== Quiz', statsStart));

    assert.match(statsSource, /function loadStats\(user,\s*\{\s*showOverlay\s*=\s*true\s*\}\s*=\s*\{\}\)/);
    assert.match(statsSource, /if\s*\(showOverlay\)\s*showLoading\(/);
    assert.match(statsSource, /if\s*\(showOverlay\)\s*hideLoading\(/);
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
    assert.match(app, /Promise\.all\(\[\s*syncLearningSettingsFromServer\(user\),\s*syncGameStateFromServer\(user\),\s*loadHome\(\),\s*\]\)/);
    assert.match(app, /Promise\.all\(\[\s*syncLearningSettingsFromServer\(user\),\s*syncGameStateFromServer\(user\),\s*loadStats\(user\),\s*\]\)/);
});

test('parent cache status derives readiness from current level counts', () => {
    const start = app.indexOf('async function loadParentLearningSettings()');
    const end = app.indexOf('async function saveParentLearningSettings()', start);
    assert.ok(start >= 0 && end > start, 'loadParentLearningSettings function should exist');
    const source = app.slice(start, end);
    assert.match(source, /getLevelCacheReadyCount\(cacheStatus, currentLevel\)/);
    assert.match(source, /derivedCacheStatus/);
    assert.match(source, /readyCountForCurrentLevel\s*>=\s*10/);
    assert.match(source, /escapeHtml\(derivedCacheStatus\)/);
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

test('quiz blocks known dirty cache content before entering the child quiz page', () => {
    const start = app.indexOf('async function startQuiz()');
    const end = app.indexOf('function isMeaningReviewQuestion', start);
    assert.ok(start >= 0 && end > start, 'startQuiz function should exist');
    const startQuizSource = app.slice(start, end);
    const gateSource = extractNamedFunction(app, 'enterFormalQuiz');

    assert.match(app, /inspectQuizContentForBlockingIssue/);
    assert.match(gateSource, /inspectQuizContentForBlockingIssue\(quiz\)/);
    assert.match(gateSource, /state\.quiz\s*=\s*null/);
    assert.match(gateSource, /题库正在修复，请稍后再试或换一套/);
    assert.ok(gateSource.indexOf('inspectFormalQuizResponse(quiz)') < gateSource.indexOf('inspectQuizContentForBlockingIssue(quiz)'));
    assert.ok(gateSource.indexOf('inspectQuizContentForBlockingIssue(quiz)') < gateSource.indexOf('state.quiz = quiz'));
    assert.doesNotMatch(startQuizSource, /inspectQuizContentForBlockingIssue\(data\)/);
});

test('quiz cache-not-ready response triggers rebuild without serial preflight', () => {
    const startQuizMatch = app.match(/async function startQuiz\(\) \{[\s\S]*?function isMeaningReviewQuestion/);
    assert.ok(startQuizMatch, 'startQuiz function should exist');
    assert.match(app, /function requestQuestionCacheRebuild\(user\)/);
    assert.match(app, /questionCache\/rebuild/);
    assert.match(app, /error\.diagnostics\s*=\s*data\.diagnostics/);
    assert.match(startQuizMatch[0], /e\.code\s*===\s*'QUESTION_CACHE_NOT_READY'/);
    assert.match(startQuizMatch[0], /await recoverQuestionCacheAfterQuizFailure\(e\.diagnostics\)/);
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

test('home quick actions expose the required four entry points', () => {
    const start = app.indexOf('function renderStudentTools()');
    const end = app.indexOf('function openStudentWordEntry()', start);
    assert.ok(start >= 0 && end > start, 'renderStudentTools function should exist');
    const renderStudentToolsSource = app.slice(start, end);

    assert.match(renderStudentToolsSource, /const hasDraft = hasActiveQuizDraft\(state\.user\)/);
    assert.match(renderStudentToolsSource, /home-v2-quick-grid/);
    assert.match(renderStudentToolsSource, /home-v2-quick-continue/);
    assert.match(renderStudentToolsSource, /home-v2-quick-bank/);
    assert.match(renderStudentToolsSource, /home-v2-quick-add/);
    assert.match(renderStudentToolsSource, /home-v2-quick-history/);

    assert.match(renderStudentToolsSource, /\u7ee7\u7eed\u4e0a\u6b21\u7ec3\u4e60/);
    assert.match(renderStudentToolsSource, /hasDraft \? '\u56de\u5230\u672a\u5b8c\u6210\u7ec3\u4e60' : '\u6682\u65e0\u672a\u5b8c\u6210\u7ec3\u4e60'/);
    assert.match(renderStudentToolsSource, /\u5df2\u5b58\u6e38\u620f\u65f6\u95f4/);
    assert.match(renderStudentToolsSource, /getBankedGameMinutes\(state\.user\)/);
    assert.match(renderStudentToolsSource, /startBankedGameNow\(\)/);
    assert.match(renderStudentToolsSource, /\u5f55\u5165\u5355\u8bcd/);
    assert.match(renderStudentToolsSource, /openStudentWordEntry\(\)/);
    assert.match(renderStudentToolsSource, /\u8003\u6838\u5386\u53f2/);
    assert.ok(renderStudentToolsSource.includes("navigateTo(\\'history\\')"));

    assert.doesNotMatch(renderStudentToolsSource, /\u5c0f\u6e38\u620f\u4f53\u9a8c|\u6570\u636e\u6a21\u5f0f|\u6e05\u7406\u6d4b\u8bd5\u6a21\u5f0f\u8bb0\u5f55|\u6e05\u7406\u6d4b\u8bd5\u8bb0\u5f55/);
    assert.doesNotMatch(renderStudentToolsSource, /renderBankedGameTimeCard\(\)/);
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
    assert.match(startQuizSource, /await syncLearningSettingsFromServer\(state\.user/);
    assert.match(startQuizSource, /state\.quizDiagnostics\s*=\s*buildQuizDiagnosticsSummary\(data\)/);
    assert.doesNotMatch(startQuizSource, /ensureLevelCacheReadyForQuiz\(state\.user/);
});

test('quiz exhausted pool shows four in-app choices instead of generic failure', () => {
    const start = app.indexOf('async function startQuiz()');
    const end = app.indexOf('function isMeaningReviewQuestion', start);
    assert.ok(start >= 0 && end > start, 'startQuiz function should exist');
    const startQuizSource = app.slice(start, end);

    assert.match(startQuizSource, /e\.code === 'QUESTION_POOL_EXHAUSTED'/);
    assert.match(startQuizSource, /showQuestionPoolExhaustedDialog\(\)/);
    assert.match(app, /function showQuestionPoolExhaustedDialog\(\)/);
    assert.match(app, /题目做完了/);
    assert.match(app, /本级别的题目都做完啦，休息一下，或去复习\/录入新词～/);
    assert.match(app, /data-action="home"/);
    assert.match(app, /data-action="review"/);
    assert.match(app, /data-action="wait"/);
    assert.match(app, /data-action="entry"/);
    assert.match(app, /navigateTo\('home'\)/);
    assert.match(app, /if \(action === 'review'\) handleQuestionPoolReview\(\)/);
    assert.match(app, /function handleQuestionPoolReview\(\)/);
    assert.match(app, /restoreActiveReview\(state\.user\)/);
    assert.match(app, /state\.session\?\.sourceTestId/);
    assert.match(app, /暂无可复习错题/);
    assert.doesNotMatch(app, /if \(action === 'review'\) startWrongAnswerReview\(\)/);
    assert.match(app, /showToast\('新词录入后约18小时生成新题，请稍后再来', 'info'\)/);
    assert.match(app, /openStudentWordEntry\(\)/);
    assert.match(styles, /\.pool-exhausted-overlay/);
    assert.match(styles, /\.pool-exhausted-actions/);
});
test('quiz submit keeps timeout recovery without automatic replay', () => {
    assert.match(app, /async function submitQuizToBackend/);
    assert.match(app, /error\?\.name\s*===\s*'AbortError'/);
    assert.match(app, /提交时间较长，正在确认结果/);
    const submitSource = app.slice(app.indexOf('async function submitQuiz()'), app.indexOf('// ========== Results =========='));
    assert.match(submitSource, /submitQuizToBackend\(payload\)/);
    assert.doesNotMatch(submitSource, /timeoutMs:\s*90000/);
    const helperStart = app.indexOf('async function submitWithTimeoutConfirmation');
    const helperEnd = app.indexOf('async function submitQuizToBackend', helperStart);
    const helperSource = app.slice(helperStart, helperEnd);
    const abortStart = helperSource.indexOf("if (error?.name === 'AbortError')");
    const abortBranch = helperSource.slice(abortStart);

    assert.doesNotMatch(abortBranch, /waitForMs/);
    assert.doesNotMatch(abortBranch, /return await request\(\)/);
    assert.match(abortBranch, /throw error;/);
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
    assert.match(app, /function openParentWordEditor/);
    assert.match(app, /function saveParentWord/);
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

test('parent word management opens a list first, then a clicked word editor with status filters', () => {
    assert.match(app, /parentWordStatusFilter/);
    assert.match(app, /function getParentWordStatusFilter/);
    assert.match(app, /status=\$\{encodeURIComponent\(statusFilter\)\}/);
    assert.match(app, /function openParentWordEditor/);
    assert.match(app, /onclick="openParentWordEditor/);

    const libraryStart = app.indexOf('function renderParentWordLibrary');
    const editorStart = app.indexOf('function openParentWordEditor', libraryStart);
    assert.ok(libraryStart >= 0 && editorStart > libraryStart, 'word list should render before editor function');
    const listSource = app.slice(libraryStart, editorStart);
    assert.match(listSource, /parent-word-status-select/);
    assert.match(listSource, /onchange="saveParentWordStatusFromList/);
    assert.match(listSource, /parentWordStatusOptions\(currentStatus\)/);
    assert.match(listSource, /parent-word-list-item/);
    assert.doesNotMatch(listSource, /<button class="parent-word-list-item"/);
});

test('parent console keeps word management behind parent access', () => {
    assert.match(html, /id="parentGatePanel"/);
    assert.match(html, /id="parentToolGrid"/);

    const parentEntryCount = (html.match(/openParentConsole\(\)/g) || []).length;
    assert.equal(parentEntryCount, 1, 'home should expose one clear parent management entry');

    const ensureStart = app.indexOf('function ensureParentPage()');
    const ensureEnd = app.indexOf('function getParentToolPanel()', ensureStart);
    assert.ok(ensureStart >= 0 && ensureEnd > ensureStart, 'dynamic parent page should exist');
    const ensureSource = app.slice(ensureStart, ensureEnd);
    assert.match(ensureSource, /parentPageMount/);
    assert.doesNotMatch(ensureSource, /openParentTool\('addWords'\)/);
    assert.match(ensureSource, /openParentTool\('queryWord'\)/);
    assert.match(ensureSource, /openParentTool\('editWords'\)/);
    assert.match(ensureSource, /openParentTool\('learningSettings'\)/);
    assert.match(ensureSource, /openParentTool\('resetChildPassword'\)/);
});

test('home quick actions include banked game time without preview or debug controls', () => {
    const start = app.indexOf('function renderStudentTools()');
    const end = app.indexOf('function openStudentWordEntry()', start);
    assert.ok(start >= 0 && end > start, 'renderStudentTools function should exist');
    const renderStudentToolsSource = app.slice(start, end);

    assert.match(renderStudentToolsSource, /\u5df2\u5b58\u6e38\u620f\u65f6\u95f4/);
    assert.match(renderStudentToolsSource, /getBankedGameMinutes\(state\.user\)/);
    assert.match(renderStudentToolsSource, /startBankedGameNow\(\)/);
    assert.doesNotMatch(renderStudentToolsSource, /\u5c0f\u6e38\u620f\u4f53\u9a8c|\u6570\u636e\u6a21\u5f0f|\u6e05\u7406\u6d4b\u8bd5\u6a21\u5f0f\u8bb0\u5f55|\u6e05\u7406\u6d4b\u8bd5\u8bb0\u5f55/);
    assert.doesNotMatch(renderStudentToolsSource, /renderBankedGameTimeCard\(\)/);
    assert.doesNotMatch(renderStudentToolsSource, /handleBankedGameTimeEntry\(\)/);
    assert.match(app, /function getBankedGameMinutes/);
    assert.match(app, /function renderAnimalGardenGame/);
});
test('quiz readiness trusts eligible backend meanings and enables at ten', () => {
    const { getLevelCacheReadyCount, getQuizCacheReadiness } = loadQuizReadinessHelpers();
    const structuredStatus = {
        configured: true,
        eligibleReadyMeanings: 10,
        byLevel: {
            '\u4e2d\u5b66': { ready: 0, total: 10, eligibleReadyMeanings: 10 },
        },
        generation: {
            counts: { pending: 2, retrying: 0, manualReview: 0, ready: 20 },
            failures: [],
        },
    };
    const legacyStatus = {
        configured: true,
        eligibleReadyMeanings: 10,
        byLevel: {
            '\u4e2d\u5b66': { ready: 10, total: 10 },
        },
    };

    assert.equal(getLevelCacheReadyCount(structuredStatus, '\u4e2d\u5b66'), 10);
    assert.equal(getQuizCacheReadiness(structuredStatus, '\u4e2d\u5b66').disabled, false);
    assert.equal(getQuizCacheReadiness(structuredStatus, '\u4e2d\u5b66').buttonLabel, '\u5f00\u59cb\u6d4b\u8bd5');
    assert.equal(getLevelCacheReadyCount(legacyStatus, '\u4e2d\u5b66'), 10);
});

test('quiz readiness allows a partial cache to start while it is still building', () => {
    const { getQuizCacheReadiness } = loadQuizReadinessHelpers();
    const readiness = getQuizCacheReadiness({
        configured: true,
        status: 'building',
        eligibleReadyMeanings: 4,
        byLevel: {
            '\u4e2d\u5b66': { ready: 4, total: 10, eligibleReadyMeanings: 4 },
        },
        generation: {
            counts: { pending: 6, retrying: 0, manualReview: 0, ready: 8 },
            failures: [],
        },
    }, '\u4e2d\u5b66');

    assert.equal(readiness.disabled, false);
    assert.equal(readiness.state, 'ready');
    assert.equal(readiness.buttonLabel, '\u5f00\u59cb\u6d4b\u8bd5');
    assert.match(readiness.detail, /\u5f53\u524d\u53ef\u6d4b\u8bd5 4 \u9898/);
    assert.match(readiness.detail, /\u6b63\u5728\u751f\u6210/);
});

test('quiz readiness exposes retrying and manual-review failures', () => {
    const { getQuizCacheReadiness } = loadQuizReadinessHelpers();
    const retrying = getQuizCacheReadiness({
        eligibleReadyMeanings: 6,
        byLevel: { '\u4e2d\u5b66': { eligibleReadyMeanings: 6 } },
        generation: {
            retrying: true,
            counts: { pending: 0, retrying: 4, manualReview: 0, ready: 12 },
            failures: [],
        },
    }, '\u4e2d\u5b66');
    assert.equal(retrying.disabled, false);
    assert.equal(retrying.state, 'ready');
    assert.equal(retrying.buttonLabel, '\u5f00\u59cb\u6d4b\u8bd5');
    assert.match(retrying.detail, /\u6b63\u5728\u91cd\u8bd5/);

    const failed = getQuizCacheReadiness({
        eligibleReadyMeanings: 0,
        byLevel: { '\u4e2d\u5b66': { eligibleReadyMeanings: 0 } },
        generation: {
            needsManualReview: true,
            counts: { pending: 0, retrying: 0, manualReview: 1, ready: 12 },
            failures: [{ wordId: 'meaning-7', lastErrorCode: 'QUALITY_REJECTED' }],
            lastError: '\u751f\u6210\u5185\u5bb9\u9700\u8981\u4eba\u5de5\u786e\u8ba4',
        },
    }, '\u4e2d\u5b66');

    assert.equal(failed.disabled, true);
    assert.equal(failed.canRetry, true);
    assert.equal(failed.state, 'manual-review');
    assert.equal(failed.action, 'rebuild');
    assert.match(failed.detail, /\u9700\u8981\u4eba\u5de5\u68c0\u67e5/);
    assert.match(failed.detail, /\u751f\u6210\u5185\u5bb9\u9700\u8981\u4eba\u5de5\u786e\u8ba4/);
});

test('ready cache rows and ready generation jobs do not count as eligible meanings', () => {
    const { getLevelCacheReadyCount, getQuizCacheReadiness } = loadQuizReadinessHelpers();
    const level = String.fromCharCode(0x4e2d, 0x5b66);
    const status = {
        configured: true,
        eligibleReadyMeanings: 4,
        byLevel: { [level]: { ready: 99, total: 99 } },
        generation: {
            counts: { pending: 0, retrying: 0, manualReview: 0, ready: 40 },
            failures: [],
        },
    };

    assert.equal(getLevelCacheReadyCount(status, level), 4);
    assert.equal(getQuizCacheReadiness(status, level).disabled, false);
});

test('quiz readiness distinguishes query errors and in-progress rebuilds from manual review', () => {
    const { getQuizCacheReadiness } = loadQuizReadinessHelpers();
    const level = String.fromCharCode(0x4e2d, 0x5b66);
    const queryError = getQuizCacheReadiness({
        eligibleReadyMeanings: 0,
        queryError: 'network timeout',
    }, level);
    const rebuilding = getQuizCacheReadiness({
        eligibleReadyMeanings: 0,
        operation: 'rebuilding',
    }, level);

    assert.equal(queryError.disabled, true);
    assert.equal(queryError.state, 'query-error');
    assert.equal(queryError.action, 'query');
    assert.match(queryError.detail, /network timeout/);
    assert.equal(rebuilding.disabled, true);
    assert.equal(rebuilding.state, 'rebuilding');
});

test('partial quiz results use the actual total and do not show ten-question reward promises', () => {
    const start = app.indexOf('function renderResults(data)');
    const end = app.indexOf('function toggleAnalysis()', start);
    assert.ok(start >= 0 && end > start, 'renderResults function should exist');
    const renderResultsSource = app.slice(start, end);

    assert.match(renderResultsSource, /const \{ correct, total, accuracy, masteredWords \} = data;/);
    assert.match(renderResultsSource, /data\.results\.forEach\(\(r, i\) =>/);
    assert.match(renderResultsSource, /reward\?\.eligible && total >= 10 && state\.session\.kind === 'quiz'/);
});

test('query retry and administrator rebuild render distinct actionable CTAs', () => {
    const renderSource = extractNamedFunction(app, 'renderQuizCacheReadiness');
    const queryRetrySource = extractNamedFunction(app, 'retryQuestionCacheStatusQuery');
    const rebuildSource = extractNamedFunction(app, 'rebuildQuestionCachePreparation');

    assert.match(renderSource, /readiness\.action\s*===\s*'query'/);
    assert.match(renderSource, /retryQuestionCacheStatusQuery/);
    assert.match(renderSource, /readiness\.action\s*===\s*'rebuild'/);
    assert.match(renderSource, /rebuildQuestionCachePreparation/);
    assert.match(queryRetrySource, /return await loadQuizCacheReadiness/);
    assert.doesNotMatch(queryRetrySource, /requestQuestionCacheRebuild|questionCache\/rebuild/);
    assert.match(rebuildSource, /await requestQuestionCacheRebuild/);
    assert.match(rebuildSource, /finally\s*{/);
    assert.match(rebuildSource, /await loadQuizCacheReadiness/);
    assert.match(rebuildSource, /throw error/);
});

test('status query failures are query errors rather than manual-review failures', () => {
    const loadSource = extractNamedFunction(app, 'loadQuizCacheReadiness');

    assert.match(loadSource, /queryError:/);
    assert.doesNotMatch(loadSource, /needsManualReview:\s*true/);
});

test('remote session query errors reject instead of becoming no active session', async () => {
    const expected = new Error('session lookup failed');
    const context = {
        DEMO_MODE: false,
        state: { user: 'student' },
        api: async () => { throw expected; },
        encodeURIComponent,
        remoteQuizSession: { active: true, testId: 'existing' },
        renderStudentTools() {},
    };
    vm.createContext(context);
    vm.runInContext('async ' + extractNamedFunction(app, 'loadRemoteQuizSession'), context);

    await assert.rejects(context.loadRemoteQuizSession('student'), /session lookup failed/);
    assert.equal(context.remoteQuizSession.testId, 'existing');
});

test('administrator rebuild refreshes readiness after success and failure without swallowing errors', async () => {
    const calls = [];
    const context = {
        DEMO_MODE: false,
        state: {
            user: 'student',
            level: 'middle',
            questionCacheStatus: { eligibleReadyMeanings: 3 },
        },
        renderQuizCacheReadiness(status) { calls.push(['render', status.operation]); },
        requestQuestionCacheRebuild: async () => { calls.push(['rebuild']); },
        loadQuizCacheReadiness: async () => { calls.push(['load']); },
        showToast() {},
        normalizeApiError(error) { return error; },
    };
    vm.createContext(context);
    vm.runInContext('async ' + extractNamedFunction(app, 'rebuildQuestionCachePreparation'), context);

    await context.rebuildQuestionCachePreparation();
    assert.deepEqual(calls, [['render', 'rebuilding'], ['rebuild'], ['load']]);

    const failure = new Error('rebuild failed');
    calls.length = 0;
    context.requestQuestionCacheRebuild = async () => { calls.push(['rebuild']); throw failure; };
    await assert.rejects(context.rebuildQuestionCachePreparation(), /rebuild failed/);
    assert.deepEqual(calls, [['render', 'rebuilding'], ['rebuild'], ['load']]);
});

test('parent rebuild refreshes parent and home readiness after success and failure', async () => {
    const calls = [];
    const context = {
        DEMO_MODE: false,
        state: { user: 'student' },
        showLoading() {},
        hideLoading() { calls.push('hide'); },
        showToast() {},
        normalizeApiError(error) { return error; },
        requestQuestionCacheRebuild: async () => { calls.push('rebuild'); },
        loadQuizCacheReadiness: async () => { calls.push('home-readiness'); },
        loadParentLearningSettings: async () => { calls.push('parent-readiness'); },
    };
    vm.createContext(context);
    vm.runInContext('async ' + extractNamedFunction(app, 'rebuildParentQuestionCache'), context);

    await context.rebuildParentQuestionCache();
    assert.deepEqual(calls, ['rebuild', 'home-readiness', 'parent-readiness', 'hide']);

    calls.length = 0;
    context.requestQuestionCacheRebuild = async () => { calls.push('rebuild'); throw new Error('parent rebuild failed'); };
    await assert.rejects(context.rebuildParentQuestionCache(), /parent rebuild failed/);
    assert.deepEqual(calls, ['rebuild', 'home-readiness', 'parent-readiness', 'hide']);
});

test('home renders cache readiness beside the start button without fixed toast gating', () => {
    const renderSource = extractNamedFunction(app, 'renderQuizCacheReadiness');
    const loadSource = extractNamedFunction(app, 'loadQuizCacheReadiness');
    const recoverySource = extractNamedFunction(app, 'recoverQuestionCacheAfterQuizFailure');
    const startQuizSource = app.slice(
        app.indexOf('async function startQuiz()'),
        app.indexOf('function isMeaningReviewQuestion')
    );

    assert.match(renderSource, /home-primary-cta/);
    assert.match(renderSource, /quiz-readiness-inline/);
    assert.match(renderSource, /button\.disabled\s*=\s*readiness\.disabled/);
    assert.match(renderSource, /retryQuestionCacheStatusQuery/);
    assert.match(renderSource, /rebuildQuestionCachePreparation/);
    assert.match(loadSource, /questionCache\/status/);
    assert.doesNotMatch(loadSource, /showToast/);
    assert.match(recoverySource, /renderQuizCacheReadinessFromDiagnostics/);
    assert.doesNotMatch(
        startQuizSource.match(/if \(e\.code === 'QUESTION_CACHE_NOT_READY'\)[\s\S]*?} else if/)?.[0] || '',
        /showToast/
    );
    assert.match(styles, /\.quiz-readiness-inline/);
    assert.match(styles, /\.home-primary-cta:disabled/);
});

test('formal quiz contract is checked before entering the answer flow', () => {
    const startQuizSource = app.slice(
        app.indexOf('async function startQuiz()'),
        app.indexOf('function isMeaningReviewQuestion')
    );
    const gateSource = extractNamedFunction(app, 'enterFormalQuiz');
    const guardIndex = gateSource.indexOf('inspectFormalQuizResponse(quiz)');
    const assignmentIndex = gateSource.indexOf('state.quiz = quiz');
    const navigationIndex = gateSource.indexOf('navigateTo', guardIndex);

    assert.ok(guardIndex >= 0, 'formal quiz response guard should run');
    assert.ok(guardIndex < assignmentIndex, 'guard should run before quiz state assignment');
    assert.ok(guardIndex < navigationIndex, 'guard should run before quiz navigation');
    assert.match(gateSource, /if \(formalQuizIssue\.blocked\)/);
    assert.match(gateSource, /await recoverFromFormalQuizBlock/);
    assert.match(gateSource, /return false/);
    assert.match(startQuizSource, /await enterFormalQuiz\(data/);
});

test('formal quiz identity validation never uses English spelling deduplication', () => {
    const formalGuardSource = extractNamedFunction(quizLogic, 'inspectFormalQuizResponse');
    const identitySource = extractNamedFunction(quizLogic, 'getQuestionMeaningId');

    assert.match(identitySource, /wordId/);
    assert.match(identitySource, /sourceRecordId/);
    assert.match(identitySource, /wordRecordId/);
    assert.doesNotMatch(identitySource, /sourceWordRecordId|word_id|source_word_record_id/);
    assert.doesNotMatch(formalGuardSource + identitySource, /question\?\.word\b|\.spelling\b|new Set/);
});

test('new, local-draft, and remote formal quiz entries share one async gate', () => {
    const gateSource = extractNamedFunction(app, 'enterFormalQuiz');
    const startSource = extractNamedFunction(app, 'startQuiz');
    const localRestoreSource = extractNamedFunction(app, 'restoreQuizDraft');
    const remoteRestoreSource = extractNamedFunction(app, 'restoreRemoteQuizSession');

    assert.match(gateSource, /inspectFormalQuizResponse\(quiz\)/);
    assert.match(gateSource, /await recoverFromFormalQuizBlock/);
    assert.match(startSource, /await enterFormalQuiz\(data/);
    assert.match(localRestoreSource, /return await enterFormalQuiz\(saved\.quiz/);
    assert.match(remoteRestoreSource, /return await enterFormalQuiz\(quiz/);
});

test('remote formal quiz restoration preserves cache contract metadata for the shared gate', () => {
    const remoteRestoreSource = extractNamedFunction(app, 'restoreRemoteQuizSession');

    assert.match(remoteRestoreSource, /source:\s*saved\.source/);
    assert.match(remoteRestoreSource, /diagnostics:\s*saved\.diagnostics/);
    assert.match(remoteRestoreSource, /partialFormalChallenge:\s*saved\.partialFormalChallenge/);
    assert.ok(
        remoteRestoreSource.indexOf('source: saved.source') < remoteRestoreSource.indexOf('enterFormalQuiz(quiz'),
        'remote metadata must be retained before the shared gate runs'
    );
});

test('formal guard recovery is awaited, observable, and refreshes readiness after rebuild settles', () => {
    const recoverySource = extractNamedFunction(app, 'recoverFromFormalQuizBlock');

    assert.match(recoverySource, /renderQuizCacheReadiness/);
    assert.match(recoverySource, /operation:\s*'rebuilding'/);
    assert.match(recoverySource, /await requestQuestionCacheRebuild/);
    assert.match(recoverySource, /finally\s*{/);
    assert.match(recoverySource, /await loadQuizCacheReadiness/);
});

test('quiz-generation recovery paths await one observable rebuild helper', async () => {
    const helperSource = extractNamedFunction(app, 'recoverQuestionCacheAfterQuizFailure');
    const startQuizSource = extractNamedFunction(app, 'startQuiz');
    const calls = [];
    const context = {
        state: { user: 'student' },
        renderQuizCacheReadinessFromDiagnostics(diagnostics) { calls.push(['render', diagnostics]); },
        requestQuestionCacheRebuild: async () => { calls.push(['rebuild']); },
        loadQuizCacheReadiness: async () => { calls.push(['readiness']); },
        showToast(message, type) { calls.push(['toast', message, type]); },
        normalizeApiError(error) { return error; },
    };
    vm.createContext(context);
    vm.runInContext('async ' + helperSource, context);

    await context.recoverQuestionCacheAfterQuizFailure({ readyCount: 2 });
    assert.deepEqual(calls, [
        ['render', { readyCount: 2 }],
        ['rebuild'],
        ['readiness'],
    ]);

    calls.length = 0;
    context.requestQuestionCacheRebuild = async () => { calls.push(['rebuild']); throw new Error('worker unavailable'); };
    await context.recoverQuestionCacheAfterQuizFailure({ readyCount: 2 });
    assert.deepEqual(calls, [
        ['render', { readyCount: 2 }],
        ['rebuild'],
        ['toast', '题库恢复失败：worker unavailable。请稍后重试，或请家长在设置中重建题库。', 'error'],
        ['readiness'],
    ]);

    assert.equal((startQuizSource.match(/await recoverQuestionCacheAfterQuizFailure\(/g) || []).length, 3);
    assert.doesNotMatch(startQuizSource, /(?<!await )requestQuestionCacheRebuild\(state\.user\)/);
});
test('frontend quiz readiness does not deduplicate words by spelling', () => {
    const source = [
        extractNamedFunction(app, 'getLevelCacheReadyCount'),
        extractNamedFunction(app, 'getQuizCacheReadiness'),
    ].join('\n');

    assert.doesNotMatch(source, /\bSet\b|word_id|spelling/);
});


test('selected-level readiness cannot be enabled by another level or the scalar fallback', () => {
    const { getLevelCacheReadyCount, getQuizCacheReadiness } = loadQuizReadinessHelpers();
    const middle = String.fromCharCode(0x4e2d, 0x5b66);
    const high = String.fromCharCode(0x9ad8, 0x4e2d);
    const status = {
        configured: true,
        eligibleReadyMeanings: 99,
        eligibleReadyMeaningsByLevel: {
            [middle]: 0,
            [high]: 12,
        },
    };

    assert.equal(getLevelCacheReadyCount(status, middle), 0);
    assert.equal(getQuizCacheReadiness(status, middle).disabled, true);
    assert.equal(getLevelCacheReadyCount(status, high), 12);
});

test('learning-level save awaits rebuild and refreshes home and parent readiness in finally', () => {
    const source = extractNamedFunction(app, 'saveParentLearningSettings');

    assert.match(source, /await requestQuestionCacheRebuild\(state\.user\)/);
    assert.match(source, /catch\s*\(rebuildError\)/);
    assert.match(source, /finally\s*\{[\s\S]*loadQuizCacheReadiness\(state\.user\)/);
    assert.match(source, /finally\s*\{[\s\S]*loadParentLearningSettings\(\)/);
});
