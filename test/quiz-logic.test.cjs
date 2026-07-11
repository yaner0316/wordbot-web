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
    formatOptionDisplayText,
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
test('formats month options as proper nouns when the option set is calendar-based', () => {
    const options = ['A. march', 'B. january', 'C. october', 'D. september'];

    assert.equal(formatOptionDisplayText('march', options), 'March');
    assert.equal(formatOptionDisplayText('january', options), 'January');
    assert.equal(formatOptionDisplayText('october', options), 'October');
    assert.equal(formatOptionDisplayText('september', options), 'September');
});

test('keeps ordinary lowercase words lowercase in non-calendar option sets', () => {
    const options = ['A. march', 'B. walk', 'C. jump', 'D. clap'];

    assert.equal(formatOptionDisplayText('march', options), 'march');
    assert.equal(formatOptionDisplayText('walk', options), 'walk');
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

test('definition analysis shows a translated stem as the question explanation', () => {
    const html = buildQuestionExplanation(
        {
            type: 2,
            context: 'A word that can refer to a person, animal, place, thing, or idea.',
            contextCN: '\u53ef\u4ee5\u6307\u4eba\u3001\u52a8\u7269\u3001\u5730\u65b9\u3001\u4e8b\u7269\u6216\u60f3\u6cd5\u7684\u8bcd\u3002',
            answer: 'B',
            options: ['A. verb', 'B. noun', 'C. adjective', 'D. adverb'],
        },
        { your: 'B', correct: true },
        escapeHtml
    );

    assert.match(html, /\u9898\u5e72\u89e3\u91ca/);
    assert.match(html, /\u53ef\u4ee5\u6307\u4eba\u3001\u52a8\u7269\u3001\u5730\u65b9/);
    assert.doesNotMatch(html, /\u9898\u5e72\u7ebf\u7d22/);
});
test('fill-in analysis shows a sentence translation as the question explanation', () => {
    const html = buildQuestionExplanation(
        {
            type: 1,
            context: 'I used bright _____ to draw a happy sun.',
            contextCN: '\u6211\u7528\u660e\u4eae\u7684\u8721\u7b14\u753b\u4e86\u4e00\u4e2a\u5f00\u5fc3\u7684\u592a\u9633\u3002',
            answer: 'A',
            options: ['A. crayons', 'B. pencils', 'C. erasers', 'D. rulers'],
        },
        { your: 'A', correct: true },
        escapeHtml
    );

    assert.match(html, /\u9898\u5e72\u89e3\u91ca/);
    assert.match(html, /\u6211\u7528\u660e\u4eae\u7684\u8721\u7b14\u753b\u4e86\u4e00\u4e2a\u5f00\u5fc3\u7684\u592a\u9633/);
    assert.doesNotMatch(html, /\u9898\u5e72\u7ebf\u7d22/);
    assert.doesNotMatch(html, /\u7a7a\u683c\u5904\u9700\u8981/);
});
test('fill-in analysis shows the completed sentence in Chinese, not English', () => {
    const html = buildQuestionExplanation(
        {
            type: 1,
            context: 'She took a course to _____ her coding skills, and soon landed a better job.',
            contextCN: '\u5979\u53c2\u52a0\u4e86\u4e00\u95e8\u8bfe\u6765\u63d0\u5347\u7f16\u7a0b\u6280\u80fd\uff0c\u5e76\u5f88\u5feb\u627e\u5230\u4e86\u66f4\u597d\u7684\u5de5\u4f5c\u3002',
            answer: 'B',
            options: ['A. restore', 'B. improve', 'C. maintain', 'D. assess'],
        },
        { your: 'B', correct: true },
        escapeHtml
    );

    const completedSentenceLine = html.match(/\u5b8c\u6574\u53e5\u5b50\uff1a<\/strong>(.*?)<\/div>/)?.[1] || '';
    assert.match(completedSentenceLine, /\u63d0\u5347\u7f16\u7a0b\u6280\u80fd/);
    assert.doesNotMatch(completedSentenceLine, /She took a course/);
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
