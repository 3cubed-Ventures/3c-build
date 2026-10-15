<p align="center"><img src="assets/3C_Build.png" alt="3C Build" width="160"></p>

# 3C Build organizations

Public directory of the organizations in the [3C Build](https://github.com/enterprises/3c-build) GitHub enterprise, published at https://3cubed-ventures.github.io/3c-build/.

## How it updates

`.github/workflows/pages.yml` runs hourly, on every push to `main`, and on demand (Actions → Build and deploy → Run workflow). Each run:

1. `node build.mjs` queries the enterprise's organizations through the GitHub GraphQL API and renders `dist/index.html`.
2. If the list changed, `orgs.json` is committed back so the repo shows the current set.
3. `dist/` is deployed to GitHub Pages.

Listing an enterprise's organizations needs a token with enterprise read access, stored as the repository secret `ENTERPRISE_TOKEN`: a classic personal access token from an enterprise owner with the `read:enterprise` and `read:org` scopes. Without the secret the build falls back to the committed `orgs.json`, so the site still deploys but won't pick up new organizations.

## Local build

```bash
node build.mjs
```

Set `ENTERPRISE_TOKEN` in the environment to fetch the live list; otherwise `orgs.json` is used.
