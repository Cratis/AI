#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Runs the screens authoring workflow on the pinned public vector without a clone of the Screenplay repository:
#   1. installs the pinned `cratis` CLI and materializes the published canonical corpus,
#   2. replays the stdio MCP transcript with the revision-checked column edit (stale apply refused, comment kept),
#   3. renders the edited folder and requires the new column in the generated application's scene.json.
# The browser run (screenplay-edited-app-browser.ts) needs Docker and Chromium, so it stays a documented manual step.
# Usage: screens-smoke.sh <work-folder>   (pins live in screens-smoke.json next to this script)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
verification="$(cd "$here/.." && pwd)"
work="$(mkdir -p "${1:?usage: screens-smoke.sh <work-folder>}" && cd "$1" && pwd)"
pin() { node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))[process.argv[2]])" "$here/screens-smoke.json" "$1"; }

cli="$(pin cli)"
corpus_package="$(pin corpusPackage)"
edited_column="$(pin editedColumn)"

rm -rf "$work/tools" "$work/materialize" "$work/corpus" "$work/model" "$work/app"
mkdir -p "$work/materialize"
dotnet tool install Cratis.Cli --version "$cli" --tool-path "$work/tools" > "$work/install.log"
export PATH="$work/tools:$PATH"
test "$(cratis --version | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)" = "$cli" || { echo "cratis is not $cli" >&2; exit 2; }

sed "s/CORPUS_VERSION/$corpus_package/" "$here/materialize-corpus.cs" > "$work/materialize/materialize-corpus.cs"
(cd "$work/materialize" && dotnet run materialize-corpus.cs "$work/corpus")

(cd "$verification" && npx tsx screenplay-mcp-transcript.ts --corpus "$work/corpus" --scratch "$work/model" --edit work-item-id-column > "$work/transcript.json")
grep -q '"columnAdded": true' "$work/transcript.json" || { echo "the MCP edit did not land" >&2; exit 1; }
grep -q '"executableReady": true' "$work/transcript.json" || { echo "the edited workspace is not executable-ready" >&2; exit 1; }

cratis render "$work/model" --name ScreenComposition --destination "$work/app" -o json > "$work/render.json"
grep -q "$edited_column" "$work/app/scene.json" || { echo "the rendered scene.json does not carry the edited column" >&2; exit 1; }
echo "screens smoke passed on cratis $cli with Cratis.Screenplay.CanonicalCorpus $corpus_package"
