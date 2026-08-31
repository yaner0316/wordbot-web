const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');

const { verifyPublicRelease } = require('../scripts/verify-public-release.cjs');

async function withReleaseServer(body, callback) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(`http://127.0.0.1:${server.address().port}/release.json`, requests);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('public frontend smoke accepts the expected release with one GET request', async () => {
  const expectedCommit = '4f1e0cf162dabcae9b5ac47ac605b7126bd2b5b0';
  await withReleaseServer({ commit: expectedCommit, source: 'render' }, async (releaseUrl, requests) => {
    const result = await verifyPublicRelease({ releaseUrl, expectedCommit });

    assert.deepEqual(result, { commit: expectedCommit, releaseUrl });
    assert.deepEqual(requests, [{ method: 'GET', url: '/release.json' }]);
  });
});

test('public frontend smoke rejects a different or malformed release marker', async () => {
  await withReleaseServer({ commit: 'b'.repeat(40), source: 'render' }, async releaseUrl => {
    await assert.rejects(
      verifyPublicRelease({ releaseUrl, expectedCommit: 'a'.repeat(40) }),
      /release SHA did not match/i
    );
  });
  await withReleaseServer({ commit: 'not-a-sha', source: 'render' }, async releaseUrl => {
    await assert.rejects(
      verifyPublicRelease({ releaseUrl, expectedCommit: 'a'.repeat(40) }),
      /release marker was invalid/i
    );
  });
});
