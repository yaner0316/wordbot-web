(function initQuizLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WordBotQuizLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createQuizLogic() {
  function normalizeArticleContext(context) {
    return String(context || '')
      .replace(/\ban\s+_____/gi, 'a(n) _____')
      .replace(/\ba\s+_____/gi, 'a(n) _____');
  }

  function adaptDemoContextByLevel(wordInfo, type, level) {
    if (type === 3) return wordInfo.cn;
    if (type === 2) {
      if (level === '小学') return `A simple way to say: ${wordInfo.meaning}.`;
      if (level === '高中') return `A word used to describe something that means: ${wordInfo.meaning}.`;
      if (level === 'CET4_6_TOEFL') return `A term denoting the following concept: ${wordInfo.meaning}.`;
      return wordInfo.meaning;
    }

    if (level === '小学') {
      return `Something that means "${wordInfo.meaning}" can be called ${wordInfo.word}.`;
    }
    if (level === '高中') {
      return wordInfo.context;
    }
    if (level === 'CET4_6_TOEFL') {
      return `Within this broader context, ${wordInfo.context.charAt(0).toLowerCase()}${wordInfo.context.slice(1)}`;
    }
    return wordInfo.context;
  }

  function optionWord(question, letter) {
    return question?.options?.find(option => option.startsWith(letter + '.'))
      ?.replace(/^[A-D]\.\s*/, '') || '';
  }

  const calendarProperNouns = new Map([
    ['january', 'January'], ['february', 'February'], ['march', 'March'],
    ['april', 'April'], ['may', 'May'], ['june', 'June'],
    ['july', 'July'], ['august', 'August'], ['september', 'September'],
    ['october', 'October'], ['november', 'November'], ['december', 'December'],
    ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'],
    ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'],
    ['sunday', 'Sunday'],
  ]);

  function cleanOptionDisplayWord(value) {
    return String(value || '').replace(/^[A-D]\.\s*/i, '').trim();
  }

  function capitalizeFirst(value) {
    const text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function formatOptionDisplayText(value, allOptions = [], question = null) {
    const word = cleanOptionDisplayWord(value);
    const key = word.toLowerCase();
    const optionWords = (allOptions || []).map(cleanOptionDisplayWord);
    const calendarCount = optionWords.filter(item => calendarProperNouns.has(item.toLowerCase())).length;
    if (calendarCount >= 2 && calendarProperNouns.has(key)) {
      return calendarProperNouns.get(key);
    }
    if (Number(question?.type) === 1) {
      return capitalizeFirst(word);
    }
    return word;
  }

  const quizContentBlockedMessage = '题库正在修复，请稍后再试或换一套';
  const dirtyPlaceholderStem = 'the student wrote _____ in the sentence.';
  const dirtyOptionWords = new Set(['genaine']);
  const repeatedDistractorSmokeWords = new Set(['bomb', 'crowded', 'genaine']);

  function inspectQuizContentForBlockingIssue(quiz) {
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    const repeatedQuestionHits = new Map();

    for (const question of questions) {
      const stem = String(question?.context || question?.question || '').trim().toLowerCase();
      if (stem === dirtyPlaceholderStem) {
        return { blocked: true, message: quizContentBlockedMessage };
      }

      const suspiciousWordsInQuestion = new Set();
      for (const option of question?.options || []) {
        const word = cleanOptionDisplayWord(option).toLowerCase();
        if (dirtyOptionWords.has(word)) {
          return { blocked: true, message: quizContentBlockedMessage };
        }
        if (repeatedDistractorSmokeWords.has(word)) suspiciousWordsInQuestion.add(word);
      }

      for (const word of suspiciousWordsInQuestion) {
        repeatedQuestionHits.set(word, (repeatedQuestionHits.get(word) || 0) + 1);
      }
    }

    const repeatedDirtyWords = [...repeatedQuestionHits.values()].filter(count => count >= 2).length;
    if (repeatedDirtyWords >= 2) {
      return { blocked: true, message: quizContentBlockedMessage };
    }

    return { blocked: false, message: '' };
  }
  function buildOptionMeaningsExplanation(question, escapeHtml) {
    if (!question?.options?.length) return '';
    const escape = escapeHtml || (value => String(value ?? ''));
    const meanings = question.optionMeanings || [];
    const lines = question.options.map((option, index) => {
      const word = option.replace(/^[A-D]\.\s*/, '');
      const letter = option.charAt(0);
      return `<div class="detail-line"><strong>${escape(letter)}. ${escape(word)}：</strong>${escape(meanings[index] || '中文释义补充失败')}</div>`;
    }).join('');
    return `<div class="detail-line" style="margin-top:4px;"><strong>选项释义：</strong></div>${lines}`;
  }

  function buildQuestionExplanation(question, result, escapeHtml) {
    if (!question) return '';
    const escape = escapeHtml || (value => String(value ?? ''));
    const correctWord = optionWord(question, question.answer);
    const selectedWord = optionWord(question, result.your);
    const correctLine = `<div class="detail-line" style="margin-top:8px;"><strong>正确选项：</strong>${escape(question.answer)}. "${escape(correctWord)}"</div>`;
    const comparison = !result.correct && selectedWord
      ? `<div class="detail-line" style="margin-top:4px;">你选择的 "${escape(selectedWord)}" 与本题给出的语境或释义不匹配；应重点区分它和 "${escape(correctWord)}" 的含义。</div>`
      : '';

    let reason = '';
    if (question.type === 1) {
      const completedSentence = question.context.replace(/_____/g, correctWord);
      const completedSentenceCN = question.contextCN || '';
      const completedSentenceDisplay = completedSentenceCN || question.correctMeaning || '中文翻译暂未生成';
      const questionExplanation = completedSentenceCN
        ? `把 "${correctWord}" 代入后，整句意思是：${completedSentenceCN}`
        : `这道题考察 "${correctWord}" 的中文释义：${question.correctMeaning || '暂无中文释义'}`;
      reason = `<div class="detail-line" style="margin-top:4px;"><strong>\u5b8c\u6574\u53e5\u5b50\uff1a</strong>${escape(completedSentenceDisplay)}</div>
        <div class="detail-line" style="margin-top:4px;color:#666;"><strong>\u9898\u5e72\u89e3\u91ca\uff1a</strong>${escape(questionExplanation)}</div>`;
    } else if (question.type === 2) {
      const questionExplanation = question.correctMeaning || question.context;
      reason = `<div class="detail-line" style="margin-top:4px;"><strong>\u9898\u5e72\u89e3\u91ca\uff1a</strong>${escape(questionExplanation)}</div>`;
    } else if (question.type === 3) {
      const questionExplanation = `\u8fd9\u4e2a\u4e2d\u6587\u91ca\u4e49\u5bf9\u5e94\u82f1\u6587\u5355\u8bcd "${correctWord}"\u3002`;
      reason = `<div class="detail-line" style="margin-top:4px;"><strong>\u9898\u5e72\u89e3\u91ca\uff1a</strong>${escape(questionExplanation)}</div>`;
    }

    return correctLine + reason + comparison;
  }
  function buildMeaningReviewExplanation(question, result, escapeHtml) {
    const escape = escapeHtml || (value => String(value ?? ''));
    const your = String(result?.your || '').trim();
    const expected = String(result?.answer || question?.correctMeaning || question?.context || '').trim();
    const verdict = result?.correct
      ? '这次写对了，说明你已经能主动回忆这个中文释义。'
      : '这次还没有完全对上，复习时重点记住参考释义里的核心意思。';
    return '<div class="detail-line" style="margin-top:4px;"><strong>你的答案：</strong>' + escape(your || '（未作答）') + '</div>' +
      '<div class="detail-line" style="margin-top:4px;"><strong>参考释义：</strong>' + escape(expected || '暂无参考释义') + '</div>' +
      '<div class="detail-line" style="margin-top:4px;"><strong>判断：</strong>' + escape(verdict) + '</div>';
  }


  return {
    adaptDemoContextByLevel,
    buildOptionMeaningsExplanation,
    buildQuestionExplanation,
    buildMeaningReviewExplanation,
    formatOptionDisplayText,
    inspectQuizContentForBlockingIssue,
    normalizeArticleContext,
    optionWord,
  };
}));
