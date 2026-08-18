#!/bin/bash

# Markdown Verification Script
# Local developer helper: lints the Documentation tree with markdownlint-cli2 and
# verifies every link with linkinator. No CI workflow runs this script, so run it
# yourself before pushing documentation changes.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

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
LINT_EXIT_CODE=0
npx markdownlint-cli2 "Documentation/**/*.md" || LINT_EXIT_CODE=$?

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
MARKDOWN_FILES=()
while IFS= read -r markdown_file; do
    MARKDOWN_FILES+=("$markdown_file")
done < <(find Documentation -type d -name node_modules -prune -o -type f -name '*.md' -print | sort)

if [ ${#MARKDOWN_FILES[@]} -eq 0 ]; then
    echo "Error: no markdown files found under Documentation/."
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
    --skip "$LOCALHOST_SKIP" || LINK_EXIT_CODE=$?

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
