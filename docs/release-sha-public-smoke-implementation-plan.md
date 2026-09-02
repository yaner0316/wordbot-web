# Frontend Release SHA Verification Implementation Plan

**Goal:** Prove that the public WordBot static site on Render serves the exact Git commit merged to `main`.

**Architecture:** A dependency-free Node build script stages the existing static assets in `dist/` and writes a validated Render release marker. A second dependency-free CLI reads one public JSON URL and requires an exact commit match. The existing workflow gains test, deploy, and main-only verification boundaries.

**Tech Stack:** Node.js 22+, node:test, GitHub Actions, Render Static Sites.

## Global Constraints

- The release marker is public and contains only a validated commit SHA and source label.
- Public smoke verification uses only one `GET` request per attempt.
- Do not read or print secrets, mutate API data, or change user-facing behavior.
- Do not delete source files, caches, records, migrations, or game data.
- Preserve existing non-main deploy behavior; only main receives the new public verification gate.

## File Structure

- `scripts/render-build.cjs`: stages the static publish directory and writes `release.json`.
- `scripts/verify-public-release.cjs`: validates a public release marker with read-only HTTP.
- `test/render-build.test.cjs`: tests staged output and SHA validation.
- `test/verify-public-release.test.cjs`: tests matching, mismatched, and unhealthy marker responses.
- `test/deploy-workflow-contract.test.cjs`: checks test/deploy/main-verification workflow boundaries.
- `.github/workflows/render-deploy.yml`: runs tests before hooks and performs main-only marker polling.
- `RENDER_DEPLOYMENT.md`: documents the exact Render build and publish settings.

## Tasks

1. Write a failing build test that expects `release.json` and existing frontend inputs in an isolated output directory.
2. Run it and confirm it fails because the build module does not exist.
3. Implement the minimal build module and CLI entrypoint, without source-file deletion.
4. Run the build test and JavaScript syntax checks.
5. Write a failing public release verifier test with a local HTTP server.
6. Run it and confirm it fails because the verifier does not exist.
7. Implement the read-only verifier with bounded CLI retry parameters.
8. Run build and verifier tests.
9. Add a failing workflow contract test for pull-request isolation, main-only verifier wiring, and the public release URL.
10. Split the workflow into test, deploy, and main-only verifier jobs; update Render documentation.
11. Run the frontend suite, syntax checks, staged-build smoke test, and exact PR diff review.
12. Commit, push, create the PR, review GitHub checks, merge only after checks pass, configure Render, and verify the deployed marker.
