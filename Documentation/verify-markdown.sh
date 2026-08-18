#!/bin/bash

# Markdown Verification Script
# Local developer helper: lints the Documentation tree and the .ai/ instruction corpus
# with markdownlint-cli2 and verifies every link with linkinator. The Documentation job in
# .github/workflows/factory-foundation.yml runs it as an advisory, non-blocking step; run
# it yourself before pushing documentation or corpus changes.
#
# The corpus is in scope on both halves. It is this repository's primary product — it is
# propagated to every other Cratis repo — and it is dense with relative cross-links
# (rules to rules, skills to rules, skills to their own references/), which is exactly
# what the link check is good at. Adding it costs about 20 seconds and 130 extra links.

set -e

# No SCRIPT_DIR/ROOT_DIR here on purpose. This script locates the tree it checks from $PWD (the
# `cd ..` below), never from its own path, so a pair of directory variables derived from
# ${BASH_SOURCE[0]} were only ever dead weight — shellcheck flagged ROOT_DIR as unused. Anchoring
# to the script's own location instead would be a real improvement, but it changes which directory
# gets linted, so it belongs in its own change rather than riding along with a lint fix.

echo "=========================================="
echo "Markdown Verification"
echo "=========================================="
echo ""

# Check if running from repository root or Documentation folder
if [ "$(basename "$PWD")" = "Documentation" ]; then
    cd ..
fi

echo "Working directory: $PWD"
echo ""

# Step 1: Markdown Linting
echo "=========================================="
echo "Step 1: Running markdownlint..."
echo "=========================================="
echo ""

if ! command -v npx &> /dev/null; then
    echo "Error: npx is not installed. Please install Node.js and npm."
    exit 1
fi

# Capture the exit code instead of letting `set -e` abort the run, so the link
# check below and the final summary still happen when linting finds problems.
#
# No glob argument: .markdownlint-cli2.jsonc at the repository root carries the globs,
# which cover Documentation/ and the .ai/ corpus. Passing "Documentation/**/*.md" here
# would be harmless (markdownlint-cli2 unions a CLI glob with the configured ones) but
# misleading, since it would read as if this script and the pinned CI invocation linted
# different sets. They lint exactly the same set.
LINT_EXIT_CODE=0
npx markdownlint-cli2 || LINT_EXIT_CODE=$?

echo ""
if [ $LINT_EXIT_CODE -eq 0 ]; then
    echo "✓ Markdown linting passed!"
else
    echo "✗ Markdown linting failed with exit code $LINT_EXIT_CODE"
fi
echo ""

# Step 2: Link Verification
echo "=========================================="
echo "Step 2: Running link verification..."
echo "=========================================="
echo ""
echo "This may take a few minutes to check all links..."
echo ""

# linkinator does not expand globs itself. Handed the literal string
# "Documentation/**/*.md" it crawls a path that matches nothing, reports
# "scanned 0 links" and exits 0 — a check that passes without verifying anything.
# Collect the files here and pass the explicit list instead. `find` rather than a
# `**` glob, because the bash that ships with macOS is 3.2 and has no globstar.
#
# The roots mirror the "globs" in .markdownlint-cli2.jsonc, so the two halves of this
# script cover the same files. Add a root here whenever a glob is added there, or the link
# check silently stops covering what the lint check covers.
MARKDOWN_FILES=()
while IFS= read -r markdown_file; do
    MARKDOWN_FILES+=("$markdown_file")
done < <(find Documentation .ai/rules .ai/skills .ai/prompts .ai/agents .ai/hooks .ai/README.md \
    -type d -name node_modules -prune -o -type f -name '*.md' -print | sort)

if [ ${#MARKDOWN_FILES[@]} -eq 0 ]; then
    echo "Error: no markdown files found under Documentation/ or .ai/."
    exit 1
fi

echo "Checking ${#MARKDOWN_FILES[@]} markdown files..."
echo ""

# Skip the local dev-server URLs documented in the Planner guides. The pattern is
# anchored to the end of the URL so it only matches a bare origin such as
# http://localhost:5200. linkinator serves the files it crawls from its own
# http://localhost:<random-port>/<path> origin, so a pattern that matched any
# localhost URL would skip every link in the run and pass having checked nothing.
LOCALHOST_SKIP='^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\/?$'

# The corpus also documents a dev-server URL that carries a path, which the bare-origin
# pattern above deliberately cannot cover. Loosening that pattern to allow any path on any
# localhost port would re-open the hole it guards against, so these are listed as anchored
# whole-URL alternatives instead: linkinator serves the crawled markdown from its own
# origin, and it can never serve a file at one of these paths. Add to the alternation when
# a new dev-server URL with a path is documented.
DEV_SERVER_PATH_SKIP='^https?:\/\/(localhost|127\.0\.0\.1):5000\/swagger\/?$'

# --directory-listing lets a link to a directory resolve the way it does on
# GitHub; without it every valid directory link is reported as a 404.
LINK_EXIT_CODE=0
npx linkinator "${MARKDOWN_FILES[@]}" \
    --markdown \
    --recurse \
    --directory-listing \
    --verbosity error \
    --status-code "403:ok" \
    --timeout 10000 \
    --skip "$LOCALHOST_SKIP" \
    --skip "$DEV_SERVER_PATH_SKIP" || LINK_EXIT_CODE=$?

echo ""
if [ $LINK_EXIT_CODE -eq 0 ]; then
    echo "✓ Link verification passed!"
else
    echo "✗ Link verification failed with exit code $LINK_EXIT_CODE"
fi
echo ""

# Final summary
echo "=========================================="
echo "Summary"
echo "=========================================="
if [ $LINT_EXIT_CODE -eq 0 ] && [ $LINK_EXIT_CODE -eq 0 ]; then
    echo "✓ All checks passed!"
    exit 0
else
    echo "✗ Some checks failed:"
    [ $LINT_EXIT_CODE -ne 0 ] && echo "  - Markdown linting"
    [ $LINK_EXIT_CODE -ne 0 ] && echo "  - Link verification"
    exit 1
fi
