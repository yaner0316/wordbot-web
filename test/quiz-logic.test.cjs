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
    buildMeaningReviewExplanation,
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

test('high-school demo fill-in contexts do not add meta explanation tails', () => {
    const word = {
        word: 'compelling',
        meaning: 'very convincing or interesting',
        cn: '令人信服的',
        context: 'The detective found compelling evidence at the scene.',
    };

    const context = adaptDemoContextByLevel(word, 1, '楂樹腑');
    assert.equal(context, word.context);
    assert.doesNotMatch(context, /which clearly illustrates/i);
    assert.doesNotMatch(context, /how the word .* is used/i);
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

test('renders Chinese meaning review feedback without multiple-choice wording', () => {
    const html = buildMeaningReviewExplanation(
        { type: 4, answerMode: 'cn_meaning', word: 'kitten' },
        { your: '小猫', answer: '小猫；幼猫', correct: true },
        escapeHtml
    );

    assert.match(html, /你的答案/);
    assert.match(html, /参考释义/);
    assert.match(html, /小猫；幼猫/);
    assert.doesNotMatch(html, /正确选项/);
});
