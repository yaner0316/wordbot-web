const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildStaticSite } = require('../scripts/render-build.cjs');

test('static Render build stages existing frontend inputs and a safe release marker', () => {
  const copied = [];
  const written = [];
  const root = path.join('C:', 'workspace', 'wordbot-web');
  const outputDir = path.join(root, 'dist');

  buildStaticSite({
    root,
    outputDir,
    env: { RENDER_GIT_COMMIT: 'A1B478611653E7715C99B1FD4929836249C57831' },
    mkdirSync: target => copied.push(['mkdir', target]),
    copyFileSync: (source, target) => copied.push(['file', source, target]),
    cpSync: (source, target) => copied.push(['tree', source, target]),
    writeFileSync: (target, contents) => written.push([target, contents]),
  });

  assert.deepEqual(copied, [
    ['mkdir', outputDir],
    ['file', path.join(root, 'index.html'), path.join(outputDir, 'index.html')],
    ['file', path.join(root, 'config.js'), path.join(outputDir, 'config.js')],
    ['tree', path.join(root, 'src'), path.join(outputDir, 'src')],
    ['tree', path.join(root, 'assets'), path.join(outputDir, 'assets')],
  ]);
  assert.deepEqual(written, [[
    path.join(outputDir, 'release.json'),
    '{"commit":"a1b478611653e7715c99b1fd4929836249c57831","source":"render"}\n',
  ]]);
});

test('static Render build rejects a missing or malformed release SHA', () => {
  assert.throws(() => buildStaticSite({ env: {} }), /release SHA/i);
  assert.throws(
    () => buildStaticSite({ env: { RENDER_GIT_COMMIT: 'not-a-sha' } }),
    /release SHA/i
  );
});
