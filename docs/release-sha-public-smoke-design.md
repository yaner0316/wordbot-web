# Frontend Release SHA and Public Smoke Design

## Goal

Make the public static frontend identify the exact Git commit Render deployed,
then make the main-branch deployment workflow prove that the public marker
matches the reviewed GitHub commit.

## Design

The frontend remains a static site. A dependency-free Node build script copies
the current published inputs (`index.html`, `config.js`, `src`, and `assets`)
to `dist/`. At Render build time it validates the documented
`RENDER_GIT_COMMIT` value as a full Git SHA and writes this public file:

```json
{"commit":"<40 lowercase hexadecimal characters>","source":"render"}
```

The file contains no credentials, application configuration, or user data.
The build fails if Render did not supply a valid commit SHA, avoiding a static
site that claims an unverifiable release.

A small Node CLI makes one read-only `GET` request to a supplied release JSON
URL. It requires HTTP success and an exact SHA match. The frontend workflow
runs its existing tests and syntax checks before the deploy hook. After a
`main` deploy, a separate verification job polls the public release JSON with
the triggering `github.sha` for a bounded period. Pull requests never invoke
the deploy hook or the public verifier.

## Render Change

After the merged code is available on `main`, the static site must be set to:

- Build command: `node scripts/render-build.cjs`
- Publish directory: `dist`

No secrets or environment variables need to be added. Render already provides
`RENDER_GIT_COMMIT` during static-site builds.

## Scope

This changes only build output and release verification. It does not modify
the user interface, API behavior, login, database, caches, migrations,
backfills, or game rewards. Existing non-main deploy behavior remains outside
this PR and will be addressed with the later runtime-ambiguity cleanup.
