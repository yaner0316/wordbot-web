# Render Deployment

This repository is configured for a Render static site through a GitHub Actions
deploy hook.

## Render static site settings

- Service type: Static Site
- Repository: `yaner0316/wordbot-web`
- Branch: `codex/frontend-engineering`
- Build command: leave empty
- Publish directory: `.`

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

After that, every push to `codex/frontend-engineering` or `main` triggers a
Render deploy. You can also run the workflow manually from GitHub Actions.
