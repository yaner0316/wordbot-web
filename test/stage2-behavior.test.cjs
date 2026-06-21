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

test('the CET and TOEFL level button has enough width for its label', () => {
    assert.match(styles, /\.difficulty-options/);
    assert.match(html, /data-level="CET4_6_TOEFL"/);
    assert.match(styles, /min-width:\s*94px/);
    assert.match(styles, /white-space:\s*nowrap/);
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

test('user buttons are created with DOM APIs instead of inline onclick HTML', () => {
    assert.match(app, /document\.createElement\('button'\)/);
    assert.match(app, /addEventListener\('click'/);
    assert.doesNotMatch(html, /onclick="selectUser\('\$\{u\}'\)"/);
});

test('quiz generation always clears the loading overlay', () => {
    assert.match(
        app,
        /async function startQuiz\(\)[\s\S]*finally\s*\{\s*hideLoading\(\);\s*\}/
    );
});

test('every quiz answer requires an explicit confidence choice', () => {
    assert.match(app, /confidences:\s*\[\]/);
    assert.match(app, /selectConfidence/);
    assert.match(app, /confidence:\s*state\.confidences\[i\]/);
    assert.match(app, /function canLeaveCurrentQuestion/);
    assert.match(app, /nextBtn'\)\.disabled\s*=\s*!canContinue/);
    assert.match(app, /submitBtn'\)\.disabled\s*=\s*!canContinue/);
    assert.match(app, /if\s*\(!canLeaveCurrentQuestion\(\)\)\s*return/);
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

test('home page exposes parent tools without hiding the child quiz flow', () => {
    assert.match(html, /parentToolGrid/);
    assert.ok(html.includes('\u5f55\u5165\u5355\u8bcd'));
    assert.ok(html.includes('\u67e5\u8be2\/\u7f16\u8f91'));
    assert.ok(html.includes('\u5b66\u4e60\u8bbe\u7f6e'));
    assert.ok(html.includes('\u7edf\u8ba1\u770b\u677f'));
    assert.match(app, /function openParentTool/);
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

test('quiz results can show animal garden reward summary from submit response', () => {
    assert.match(app, /function buildAnimalGardenRewardHtml/);
    assert.match(app, /data\.rewardSummary/);
    assert.match(app, /animal-garden-card/);
    assert.match(styles, /\.animal-garden-card/);
});

test('game reward minutes are banked and offered after at least one review round', () => {
    assert.match(app, /GAME_TIME_BANK_KEY_PREFIX/);
    assert.match(app, /function addGameRewardToBank/);
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

test('dev and demo modes expose a mini game preview entry', () => {
    assert.match(app, /function startGamePreview/);
    assert.match(app, /DEV_MODE[\s\S]*startGamePreview/);
    assert.match(html + app, /\u5c0f\u6e38\u620f\u4f53\u9a8c/);
});

test('mini game preview is on the home actions, not quiz navigation', () => {
    assert.match(html, /id="pageHome"[\s\S]*id="gamePreviewBtn"/);
    assert.doesNotMatch(html, /class="quiz-nav"[\s\S]*id="gamePreviewBtn"/);
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
    const brokenTextPattern = /宸|寰|鎬|鑰|姝|馃|鏌ョ湅|缁х画|涓嬫|寮.|鐢熸|璇峰|绗.|棣栨|淇濆瓨|澶辫触|瀛︿範|锛|銆|鈥|鉁|\?\/div|\?\/span|\?\{escapeHtml|\?\{formatDate/;
    assert.doesNotMatch(app, brokenTextPattern);
});

test('home stats and game prompts render clean Chinese text', () => {
    assert.ok(app.includes("const DEFAULT_LEVEL = '\u4e2d\u5b66'"));
    assert.ok(app.includes('\u5df2\u638c\u63e1'));
    assert.ok(app.includes('\u5f85\u590d\u4e60'));
    assert.ok(app.includes('\u603b\u8bcd\u6c47'));
    assert.ok(app.includes('\u8003\u6838\u6b21\u6570'));
    assert.ok(app.includes('\u6b63\u786e\u7387'));
    assert.ok(app.includes('\u4e0a\u6b21\u8003\u6838'));
    assert.ok(app.includes('\u6e05\u7406\u6d4b\u8bd5\u6a21\u5f0f\u8bb0\u5f55'));
    assert.ok(app.includes('\u5c0f\u6e38\u620f\u65f6\u95f4'));
    assert.ok(app.includes('\u5b58\u7559\u65f6\u95f4'));
    assert.ok(app.includes('\u73b0\u5728\u73a9'));
    assert.ok(app.includes('\u4e0b\u6b21\u73a9'));
    assert.doesNotMatch(app, /宸叉帉鎻|寰呭|鎬昏瘝|鑰冩牳|姝ｇ|馃晲|馃棏|\?\{formatDate|\?\{escapeHtml\(user\)/);
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
