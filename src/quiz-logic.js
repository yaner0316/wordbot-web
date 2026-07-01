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
      const cnLine = question.contextCN
        ? `<div class="detail-line" style="margin-top:2px;color:#666;">${escape(question.contextCN)}</div>`
        : '';
      reason = `<div class="detail-line" style="margin-top:4px;"><strong>完整句子：</strong>${escape(completedSentence)}</div>
        ${cnLine}<div class="detail-line" style="margin-top:4px;"><strong>题干线索：</strong>空格处需要 "${escape(correctWord)}"，代入后句意完整，并与句中其余信息形成合理语义关系。</div>`;
    } else if (question.type === 2) {
      reason = `<div class="detail-line" style="margin-top:4px;"><strong>题干线索：</strong>英文释义 "${escape(question.context)}" 直接描述了 "${escape(correctWord)}" 的核心含义。</div>`;
    } else if (question.type === 3) {
      reason = `<div class="detail-line" style="margin-top:4px;"><strong>题干线索：</strong>中文释义 "${escape(question.context)}" 对应的英文词是 "${escape(correctWord)}"。</div>`;
    }

    return correctLine + reason + comparison;
  }

  return {
    adaptDemoContextByLevel,
    buildOptionMeaningsExplanation,
    buildQuestionExplanation,
    normalizeArticleContext,
    optionWord,
  };
}));
