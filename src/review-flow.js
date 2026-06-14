(function attachReviewFlow(root) {
  function getResultActions({
    sessionKind,
    analysisViewed,
    remainingRecordIds = [],
  }) {
    if (!analysisViewed) {
      return { primary: 'show-analysis', secondary: null };
    }
    if (remainingRecordIds.length === 0) {
      return { primary: 'complete', secondary: null };
    }
    if (sessionKind === 'review') {
      return { primary: 'continue-review', secondary: 'defer-review' };
    }
    return { primary: 'start-review', secondary: null };
  }

  function buildReviewSummary({
    firstResult,
    reviewRounds = [],
    deferredRecordIds = [],
  }) {
    const reviewed = new Set();
    const corrected = new Set();
    reviewRounds.forEach(round => {
      (round.results || []).forEach(result => {
        const id = result.recordId || result.word;
        if (!id) return;
        reviewed.add(id);
        if (result.correct) corrected.add(id);
      });
    });
    return {
      firstCorrect: firstResult?.correct || 0,
      firstTotal: firstResult?.total || 0,
      reviewed: reviewed.size,
      corrected: corrected.size,
      deferredRecordIds: [...deferredRecordIds],
    };
  }

  root.WordBotReviewFlow = {
    buildReviewSummary,
    getResultActions,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
