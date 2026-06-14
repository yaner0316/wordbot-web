const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {};
vm.createContext(context);
vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'quiz-logic.js'), 'utf8'),
    context
);

const {
    adaptDemoContextByLevel,
    buildOptionMeaningsExplanation,
    buildQuestionExplanation,
    normalizeArticleContext,
    optionWord,
} = context.WordBotQuizLogic;

const escapeHtml = value => String(value);

test('normalizes a or an before a fill-in blank', () => {
    assert.equal(
        normalizeArticleContext('This is a _____ example.'),
        'This is a(n) _____ example.'
    );
    assert.equal(
        normalizeArticleContext('It was an _____ opportunity.'),
        'It was a(n) _____ opportunity.'
    );
});

test('adapts demo contexts without changing the tested word', () => {
    const word = {
        word: 'significant',
        meaning: 'important or meaningful',
        cn: '重要的',
        context: 'There was a significant increase.',
    };

    assert.match(adaptDemoContextByLevel(word, 1, '小学'), /significant/);
    assert.match(adaptDemoContextByLevel(word, 1, 'CET4_6_TOEFL'), /significant/);
    assert.equal(adaptDemoContextByLevel(word, 3, '小学'), '重要的');
});

test('finds the option word by answer letter', () => {
    const question = { options: ['A. abandon', 'B. resilient'] };
    assert.equal(optionWord(question, 'B'), 'resilient');
});

test('renders all option meanings before the reasoning', () => {
    const question = {
        type: 2,
        context: 'able to recover quickly',
        answer: 'B',
        options: ['A. abandon', 'B. resilient'],
        optionMeanings: ['放弃', '有韧性的'],
    };
    const result = { your: 'A', correct: false };

    const meanings = buildOptionMeaningsExplanation(question, escapeHtml);
    const reasoning = buildQuestionExplanation(question, result, escapeHtml);

    assert.match(meanings, /A\. abandon：<\/strong>放弃/);
    assert.match(meanings, /B\. resilient：<\/strong>有韧性的/);
    assert.match(reasoning, /正确选项/);
    assert.match(reasoning, /你选择的 "abandon"/);
});
