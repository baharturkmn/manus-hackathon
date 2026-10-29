#!/usr/bin/env bash
# Commits public/data/live.json if it changed and pushes it. Two jobs (forecast
# on GitHub, reservoir on the self-hosted runner) update the same file, so when
# the push loses a race we start from the other job's commit and redo our part.
set -u
file=public/data/live.json
branch="${GITHUB_REF_NAME:-main}"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
for attempt in 1 2 3; do
  if git diff --quiet -- "$file" && ! git ls-files --others --exclude-standard -- "$file" | grep -q .; then
    echo "No data change."
    exit 0
  fi
  git add "$file"
  git commit -q -m "$1"
  if git push -q origin "HEAD:$branch"; then
    echo "Pushed live data update."
    exit 0
  fi
  echo "Push rejected (attempt $attempt); refetching and redoing this job's part."
  git fetch -q origin "$branch"
  git reset -q --hard "origin/$branch"
  node scripts/update-live-data.mjs || true
done
exit 1
