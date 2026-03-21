#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.1.0"
  exit 1
fi

echo "Releasing v$VERSION..."

# Bump version in all packages
pnpm -r exec npm version "$VERSION" --no-git-tag-version --allow-same-version
npm version "$VERSION" --no-git-tag-version --allow-same-version

# Build and test
pnpm build
pnpm test

# Publish to npm in dependency order
echo ""
echo "Publishing packages..."
pnpm --filter @typecek/runtime publish --access public --no-git-checks
pnpm --filter @typecek/core publish --access public --no-git-checks
pnpm --filter @typecek/compiler publish --access public --no-git-checks
pnpm --filter @typecek/cli publish --access public --no-git-checks

# Commit version bump and tag
git add -A
git commit -m "v$VERSION"
git tag "v$VERSION"

echo ""
echo "Done! Run 'git push && git push --tags' to trigger the GitHub release."
