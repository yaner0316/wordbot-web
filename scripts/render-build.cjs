const fs = require('node:fs');
const path = require('node:path');

const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

function releaseMarker(env = process.env) {
  const commit = String(env.RENDER_GIT_COMMIT || '').toLowerCase();
  if (!GIT_SHA_PATTERN.test(commit)) throw new Error('Render release SHA must be a full Git commit');
  return { commit, source: 'render' };
}

function buildStaticSite({
  root = path.resolve(__dirname, '..'),
  outputDir = path.resolve(root, 'dist'),
  env = process.env,
  mkdirSync = fs.mkdirSync,
  copyFileSync = fs.copyFileSync,
  cpSync = fs.cpSync,
  writeFileSync = fs.writeFileSync,
} = {}) {
  const release = releaseMarker(env);
  mkdirSync(outputDir, { recursive: true });
  for (const file of ['index.html', 'config.js']) {
    copyFileSync(path.join(root, file), path.join(outputDir, file));
  }
  for (const directory of ['src', 'assets']) {
    cpSync(path.join(root, directory), path.join(outputDir, directory), { recursive: true });
  }
  writeFileSync(
    path.join(outputDir, 'release.json'),
    `${JSON.stringify(release)}\n`,
    'utf8'
  );
}

if (require.main === module) buildStaticSite();

module.exports = {
  buildStaticSite,
};
