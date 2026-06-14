const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'review-flow.js'),
    'utf8'
);
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
