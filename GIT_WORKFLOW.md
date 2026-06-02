# Git Workflow — Legacy Fusion Support System

## Branch Structure

| Branch | Purpose |
|--------|---------|
| `main` | Production — only receives merges from `development` via approved PR |
| `development` | Active development — all features and fixes land here |

## Rules

1. **Never commit directly to `main`**
2. All work goes to `development`
3. When ready to release, create a PR from `development` → `main`
4. PRs to `main` must be approved manually by the project owner before merging

## Daily Workflow

### Starting a new feature or fix
```bash
git checkout development
git pull origin development
# make changes
git add .
git commit -m "feat/fix: description"
git push origin development
```

### Creating a PR to main (when requested)
```bash
gh pr create \
  --base main \
  --head development \
  --title "Release vX.X.X — description" \
  --body "release notes here"
```

### After PR is approved and merged
```bash
git checkout main
git pull origin main
git checkout development
git merge main
git push origin development
```

### Release tags
Tags are created on `main` after the PR is merged, not on `development`.

## Batch Header Template
Every batch must include at the top:
BRANCH: development

## Important Notes
- Cloudflare deploys automatically from `main`
- `development` pushes do NOT trigger Cloudflare deploy
- To deploy: merge development → main via approved PR
- Release tags (v1.x.x) are created on main only
