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
const garden3d = fs.existsSync(path.join(__dirname, '..', 'src', 'animal-garden-3d.js'))
    ? fs.readFileSync(path.join(__dirname, '..', 'src', 'animal-garden-3d.js'), 'utf8')
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
    assert.match(app, /开始错题复习/);
    assert.match(app, /查看答案解析/);
    assert.match(app, /继续复习/);
    assert.match(app, /下次复习/);
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
    assert.match(app, /nextBtn'\)\.style\.display = isLastQuestion \? 'none' : 'flex'/);
    assert.match(app, /submitBtn'\)\.style\.display = isLastQuestion \? 'flex' : 'none'/);
});

test('quiz results can show game time rewards', () => {
    assert.match(app, /function calculateDemoGameReward/);
    assert.match(app, /gameReward:\s*calculateDemoGameReward/);
    assert.match(app, /game-reward-card/);
    assert.match(styles, /\.game-reward-card/);
});

test('home page exposes parent tools without hiding the child quiz flow', () => {
    assert.match(html, /parentToolGrid/);
    assert.match(html, /录入单词/);
    assert.match(html, /查询\/编辑/);
    assert.match(html, /学习设置/);
    assert.match(html, /统计看板/);
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

test('animal garden rewards render as 3D growth controls instead of text-only counters', () => {
    assert.match(app, /function renderGardenMeters/);
    assert.match(app, /function renderGardenInventory/);
    assert.match(app, /function renderGardenWardrobe/);
    assert.match(app, /function mountCurrentAnimalGarden3D/);
    assert.match(app, /garden-meters/);
    assert.match(app, /garden-inventory/);
    assert.match(app, /garden-3d-stage/);
    assert.match(app, /garden-stage-overlay/);
    assert.match(styles, /\.garden-meter-card/);
    assert.match(styles, /\.garden-inventory-item/);
    assert.match(styles, /\.garden-3d-stage/);
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
    assert.ok(!app.includes('鐢ㄦ埛涓嶅瓨鍦紝鍙互鍏堟敞鍐'));
});
test('animal garden care action triggers 3D falling reward drops', () => {
    assert.match(app, /lastAction:\s*action/);
    assert.match(app, /mountCurrentAnimalGarden3D/);
    assert.match(garden3d, /function createRewardDrops/);
    assert.match(garden3d, /drop.userData.velocity/);
    assert.match(garden3d, /action === 'care'/);
    assert.match(garden3d, /action === 'collect'/);
});

test('main frontend strings do not leak mojibake or broken template fragments', () => {
    const brokenTextPattern = /宸|寰|鎬|鑰|姝|馃|鏌ョ湅|缁х画|涓嬫|寮.|鐢熸|璇峰|绗.|棣栨|淇濆瓨|澶辫触|瀛︿範|锛|銆|鈥|鉁|\?\/div|\?\/span|\?\{escapeHtml|\?\{formatDate/;
    assert.doesNotMatch(app, brokenTextPattern);
});

test('home stats and game prompts render clean Chinese text', () => {
    assert.match(app, /const DEFAULT_LEVEL = '中学'/);
    assert.match(app, /已掌握/);
    assert.match(app, /待复习/);
    assert.match(app, /总词汇/);
    assert.match(app, /考核次数/);
    assert.match(app, /正确率/);
    assert.match(app, /上次考核/);
    assert.match(app, /清理测试模式记录/);
    assert.match(app, /小游戏时间/);
    assert.match(app, /存留时间/);
    assert.match(app, /现在玩/);
    assert.match(app, /下次玩/);
    assert.doesNotMatch(app, /宸叉帉鎻|寰呭|鎬昏瘝|鑰冩牳|姝ｇ|馃晲|馃棏|\?\{formatDate|\?\{escapeHtml\(user\)/);
});

test('animal garden uses a Three.js 3D stage instead of 2D sticker sprites', () => {
    assert.match(html, /<script type="module" src="src\/animal-garden-3d\.js(?:\?v=[^"]+)?"><\/script>/);
    assert.match(app, /garden-3d-stage/);
    assert.match(app, /mountAnimalGarden3D/);
    assert.match(garden3d, /from 'https:\/\/unpkg\.com\/three@/);
    assert.match(garden3d, /function mountAnimalGarden3D/);
    assert.match(garden3d, /function createGardenPet/);
    assert.match(garden3d, /function createGardenOutfit/);
    assert.match(garden3d, /function createVisitorGroup/);
    assert.match(garden3d, /function createGardenFoodBowl/);
    assert.match(garden3d, /function createGardenPlants/);
    assert.match(garden3d, /WebGLRenderer/);
    assert.match(styles, /\.garden-3d-stage/);
    assert.doesNotMatch(app, /garden-pet-body/);
    assert.doesNotMatch(app, /animal-visitor-chip/);
});

test('animal garden main character is a polished 3D baby dragon', () => {
    assert.match(garden3d, /function createGardenDragon/);
    assert.match(garden3d, /garden-dragon-3d/);
    assert.match(garden3d, /createDragonHorn/);
    assert.match(garden3d, /createDragonWing/);
    assert.match(garden3d, /createDragonTail/);
    assert.match(garden3d, /createDragonSpikes/);
    assert.match(garden3d, /function createCheek/);
    assert.match(garden3d, /dragon-big-head/);
    assert.match(garden3d, /dragon-belly-panel/);
    assert.match(garden3d, /dragon-open-mouth/);
    assert.match(garden3d, /dragon-spine-crest/);
    assert.match(garden3d, /dragon-fore-claw-left/);
    assert.match(garden3d, /dragonOrange/);
    assert.match(garden3d, /createGardenDragon\(garden\)/);
    assert.doesNotMatch(garden3d, /function createEar\(side\)/);
});

test('animal garden scene maps resources to 3D objects and restrained equipment', () => {
    assert.match(garden3d, /function createGardenPlants\(garden = \{\}\)/);
    assert.match(garden3d, /function createGardenFoodBowl\(garden = \{\}\)/);
    assert.match(garden3d, /function createVisitorGroup\(garden = \{\}\)/);
    assert.match(garden3d, /function createGardenOutfit\(outfit = '草帽'\)/);
    assert.match(garden3d, /case '莓果领结'/);
    assert.match(garden3d, /case '星星挎包'/);
    assert.match(garden3d, /case '探险铃'/);
    assert.match(garden3d, /x:\s*-2\.35/);
    assert.match(garden3d, /x:\s*2\.35/);
    assert.doesNotMatch(garden3d, /emoji|innerHTML|animal-visitor-chip/);
});

test('animal garden v0.3 keeps polished meters with a dedicated 3D stage', () => {
    assert.match(app, /function getGardenLevel/);
    assert.match(app, /function renderGardenMeters/);
    assert.match(app, /function renderGardenInventory/);
    assert.match(app, /function renderGardenWardrobe/);
    assert.match(app, /id="animalGarden3DStage"/);
    assert.match(app, /data-outfit=/);
    assert.match(styles, /\.garden-meter-fill/);
    assert.match(styles, /\.garden-wardrobe/);
    assert.match(styles, /\.garden-stage-overlay/);
    assert.match(styles, /\.garden-3d-fallback/);
    assert.doesNotMatch(styles, /\.equipment-scarf[\s\S]*bottom:\s*18px/);
});



