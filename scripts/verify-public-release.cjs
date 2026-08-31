const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

function normalizeExpectedCommit(value) {
  const commit = String(value || '').toLowerCase();
  if (!GIT_SHA_PATTERN.test(commit)) throw new Error('expected release SHA must be a full Git commit');
  return commit;
}

async function verifyPublicRelease({
  releaseUrl,
  expectedCommit,
  fetchImpl = fetch,
  timeoutMs = 10_000,
} = {}) {
  const expected = normalizeExpectedCommit(expectedCommit);
  const response = await fetchImpl(releaseUrl, {
    method: 'GET',
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error('public release marker did not return success');
  const marker = await response.json();
  if (!GIT_SHA_PATTERN.test(String(marker?.commit || ''))) {
    throw new Error('public release marker was invalid');
  }
  if (String(marker.commit).toLowerCase() !== expected) throw new Error('release SHA did not match');
  return { commit: expected, releaseUrl };
}

function parseCliArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!['--release-url', '--expected-commit', '--attempts', '--interval-ms'].includes(name) || !value) {
      throw new Error('invalid public release verification arguments');
    }
    values[name] = value;
  }
  return values;
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error('invalid public release verification retry settings');
  }
  return number;
}

async function runCli(args = process.argv.slice(2)) {
  const options = parseCliArguments(args);
  const attempts = boundedInteger(options['--attempts'], 1, 1, 60);
  const intervalMs = boundedInteger(options['--interval-ms'], 5_000, 0, 60_000);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await verifyPublicRelease({
        releaseUrl: options['--release-url'],
        expectedCommit: options['--expected-commit'],
      });
      return;
    } catch (_) {
      if (attempt === attempts) throw new Error('public release verification failed');
    }
    if (intervalMs > 0) await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

if (require.main === module) {
  runCli().then(
    () => console.log('public release verification passed'),
    () => {
      console.error('public release verification failed');
      process.exitCode = 1;
    }
  );
}

module.exports = {
  verifyPublicRelease,
};
