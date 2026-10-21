const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'review-flow.js'),
    'utf8'
);
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
test('demo review shuffles while preserving the words and their answer identities', () => {
    const start = appSource.indexOf('function generateDemoReviewQuiz(');
    const end = appSource.indexOf('\nasync function startWrongAnswerReview', start);
    const original = ['apple','pear','desk'].map(word=>({word,recordId:word}));
    const c = {state:{quiz:{questions:original},session:{remainingRecordIds:['apple','pear','desk'],round:0}},
      DEMO_WORDS:original.map(q=>({...q,cn:q.word+'释义'})),shuffle:values=>[...values]};
    vm.createContext(c);vm.runInContext(appSource.slice(start,end),c);
    const result = c.generateDemoReviewQuiz();
    assert.notDeepEqual(Array.from(result.questions,q=>q.recordId),original.map(q=>q.recordId));
    assert.deepEqual(Array.from(result.questions,q=>q.recordId).sort(),original.map(q=>q.recordId).sort());
    assert.ok(result.questions.every(q=>q.correctMeaning===q.recordId+'释义'));
    assert.deepEqual(original.map(q=>q.recordId),['apple','pear','desk']);
});
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const {
    buildReviewSummary,
    getResultActions,
} = context.globalThis.WordBotReviewFlow;

test('first result requires analysis before review starts', () => {
    assert.deepEqual(
        JSON.parse(JSON.stringify(getResultActions({
            sessionKind: 'quiz',
            analysisViewed: false,
            remainingRecordIds: ['word-1'],
        }))),
        { primary: 'show-analysis', secondary: null }
    );
});

test('after analysis first wrong answers start mandatory review', () => {
    assert.equal(
        getResultActions({
            sessionKind: 'quiz',
            analysisViewed: true,
            remainingRecordIds: ['word-1'],
        }).primary,
        'start-review'
    );
});

test('submitted review with remaining words offers continue or defer', () => {
    assert.deepEqual(
        JSON.parse(JSON.stringify(getResultActions({
            sessionKind: 'review',
            analysisViewed: true,
            remainingRecordIds: ['word-1'],
        }))),
        { primary: 'continue-review', secondary: 'defer-review' }
    );
});

test('review summary preserves the original first score', () => {
    assert.deepEqual(
        JSON.parse(JSON.stringify(buildReviewSummary({
            firstResult: { correct: 7, total: 10 },
            reviewRounds: [
                { results: [
                    { recordId: 'word-1', correct: true },
                    { recordId: 'word-2', correct: false },
                ] },
                { results: [{ recordId: 'word-2', correct: true }] },
            ],
            deferredRecordIds: [],
        }))),
        {
            firstCorrect: 7,
            firstTotal: 10,
            reviewed: 2,
            corrected: 2,
            deferredRecordIds: [],
        }
    );
});

test('selected-sense reviews render four Chinese choices and submit the selected letter', () => {
  assert.match(appSource, /function isSenseChoiceReviewQuestion/);
  assert.match(appSource, /CN 释义选择/);
  assert.match(appSource, /String\.fromCharCode\(65 \+ answer\)/);
  assert.match(appSource, /selectedSenseFlow: true/);
});
