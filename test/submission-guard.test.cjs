const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

test('quiz submission has a re-entry guard and restores controls in finally', () => {
    assert.match(app, /submitting:\s*false/);
    assert.match(app, /if\s*\(state\.submitting\)\s*return/);
    assert.match(app, /state\.submitting\s*=\s*true/);
    assert.match(app, /submitBtn'\)\.disabled\s*=\s*true/);
    assert.match(app, /finally\s*\{[\s\S]*state\.submitting\s*=\s*false/);
    assert.match(app, /submitBtn'\)\.disabled\s*=\s*false/);
});
