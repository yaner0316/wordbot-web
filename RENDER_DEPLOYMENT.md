# Render Deployment

This repository is configured for a Render static site through a GitHub Actions
deploy hook.

## Render static site settings

- Service type: Static Site
- Repository: `yaner0316/wordbot-web`
- Branch: `main`
- Build command: `node scripts/render-build.cjs`
- Publish directory: `dist`

The frontend reads the backend URL from `config.js`:

```js
window.WORDBOT_CONFIG = {
  API_BASE: 'https://wordbot-1-w9il.onrender.com',
};
```

Update that value if your backend Render service URL changes.

## GitHub Actions deploy hook

In Render, open the static site and copy its Deploy Hook URL. In GitHub, add it
as a repository secret:

- Repository: `yaner0316/wordbot-web`
- Secret name: `RENDER_DEPLOY_HOOK_URL`
- Secret value: the Render Deploy Hook URL

After that, only a push to `main` triggers the Render deploy hook, and only
after the test job succeeds. Pushes to other branches, pull requests, and
manual runs do not trigger a production deployment. After a `main` deployment,
the workflow polls the public `/release.json` marker for the exact triggering
Git SHA. The marker and check use only public, read-only data.
