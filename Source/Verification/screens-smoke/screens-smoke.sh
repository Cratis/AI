#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Runs the screens authoring workflow on the pinned public vector without a clone of the Screenplay repository:
#   1. installs the pinned `cratis` CLI and materializes the published canonical corpus,
#   2. replays the stdio MCP transcript with the revision-checked column edit (stale apply refused, comment kept),
#   3. renders the edited folder and requires the new column in the generated application's scene.json.
#   4. renders the application shell fixture (shell/application.play: topbar and sidebar regions that inherit, extend and override per
#      module, a toolbar button that starts a State Change slice, a sample data pack) with the pinned `shellCli` and requires the
#      navigation, the toolbar button and the absence of the sample data in the generated application (spec SD6),
#   5. with SCREENS_SMOKE_BROWSER=1 (the CI job sets it), runs the edited model with `cratis run` (Docker) and checks the
#      edited column and a created row in Chromium (screenplay-edited-app-browser.ts, pinned Playwright).
# Usage: screens-smoke.sh <work-folder>   (pins live in screens-smoke.json next to this script)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
verification="$(cd "$here/.." && pwd)"
work="$(mkdir -p "${1:?usage: screens-smoke.sh <work-folder>}" && cd "$1" && pwd)"
pin() { node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))[process.argv[2]])" "$here/screens-smoke.json" "$1"; }

cli="$(pin cli)"
corpus_package="$(pin corpusPackage)"
edited_column="$(pin editedColumn)"
shell_cli="$(pin shellCli)"

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
# The application shell needs a newer CLI than the column edit above: the one that bundles the Stage that loads regions, slice buttons and sample data.
rm -rf "$work/shell-tools" "$work/shell-model" "$work/shell-app"
dotnet tool install Cratis.Cli --version "$shell_cli" --tool-path "$work/shell-tools" > "$work/shell-install.log"
test "$("$work/shell-tools/cratis" --version | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)" = "$shell_cli" || { echo "cratis is not $shell_cli" >&2; exit 2; }
mkdir -p "$work/shell-model" && cp "$here/shell/application.play" "$work/shell-model/application.play"
"$work/shell-tools/cratis" render "$work/shell-model" --name Shell --destination "$work/shell-app" -o json > "$work/shell-render.json" 2> "$work/shell-render.err"
node -e '
const fs = require("fs");
const scene = JSON.parse(fs.readFileSync(process.argv[1] + "/scene.json", "utf8"));
const modes = new Set();
const targets = [];
const walk = value => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value && typeof value === "object") {
        if (typeof value.mode === "string") modes.add(value.mode);
        if (value.target && value.target.module) targets.push(value.target.module + (value.target.feature ? "." + value.target.feature : ""));
        Object.values(value).forEach(walk);
    }
};
walk(scene.navigation);
const text = fs.readFileSync(process.argv[1] + "/scene.json", "utf8");
const fail = message => { console.error(message); process.exit(1); };
if (!scene.navigation || !scene.navigation.modules || scene.navigation.modules.length < 2) fail("the rendered scene has no per-module navigation");
for (const target of ["Sales.Orders", "Sales.Customers", "Support.Tickets", "Support.KnowledgeBase"]) if (!targets.includes(target)) fail("navigation item target " + target + " is missing; found " + targets.join(","));
if (!text.includes("Sales.Orders.PlaceOrder")) fail("the toolbar button does not carry its slice");
if (text.includes("Sample customer that must never ship")) fail("sample data reached the generated application");
console.log("shell navigation targets: " + [...new Set(targets)].join(", "));
' "$work/shell-app"
if grep -rq "Sample customer that must never ship" "$work/shell-app" --include='*.json' --include='*.cs' --include='*.ts' --include='*.tsx'; then echo "sample data reached the generated application" >&2; exit 1; fi
echo "application shell rendered with cratis $shell_cli"

if [[ "${SCREENS_SMOKE_BROWSER:-}" == "1" ]]; then
    playwright="$(pin playwright)"
    rm -rf "$work/browser"
    mkdir -p "$work/browser"
    (cd "$work/browser" && npm init -y >/dev/null && npm install --no-audit --no-fund "playwright@$playwright" >/dev/null)
    if [[ "$(uname)" == "Linux" ]]; then
        "$work/browser/node_modules/.bin/playwright" install --with-deps chromium >/dev/null
    else
        "$work/browser/node_modules/.bin/playwright" install chromium >/dev/null
    fi
    (cd "$verification" && SCREENPLAY_PLAYWRIGHT_NODE_PATH="$work/browser/node_modules" npx tsx screenplay-edited-app-browser.ts --model "$work/model" > "$work/browser.json") \
        || { cat "$work/browser.json" >&2; echo "the edited application did not show the edited column in the browser" >&2; exit 1; }
    grep -q '"status": "passed"' "$work/browser.json" || { cat "$work/browser.json" >&2; exit 1; }
    echo "browser run passed: $(grep -c '"passed": true' "$work/browser.json") checks"
fi
echo "screens smoke passed on cratis $cli with Cratis.Screenplay.CanonicalCorpus $corpus_package"
