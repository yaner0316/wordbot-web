const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');
const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'render-deploy.yml'), 'utf8').replace(/\r\n/g, '\n');

test('frontend workflow tests pull requests without triggering the Render deploy hook', () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /^  test:$/m);
  assert.match(workflow, /^  deploy:\n    needs: test\n    if: github\.event_name == 'push'$/m);
});

test('main frontend deployment verifies the public static release marker', () => {
  assert.match(workflow, /^  verify_release:\n    needs: deploy\n    if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'$/m);
  assert.match(workflow, /node scripts\/render-build\.cjs/);
  assert.match(workflow, /verify-public-release\.cjs/);
  assert.match(workflow, /--release-url\s+https:\/\/wordbot-web\.onrender\.com\/release\.json/);
  assert.match(workflow, /--expected-commit\s+\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /--attempts\s+40/);
  assert.match(workflow, /--interval-ms\s+15000/);
});
