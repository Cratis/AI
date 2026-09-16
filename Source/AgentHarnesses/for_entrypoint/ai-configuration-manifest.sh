#!/usr/bin/env bash
# Verifies the worker validates its mounted AI configuration manifest and never sources it.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="${HERE}/../entrypoint.sh"
WORK="${HERE}/aiconfigtest"
rm -rf "$WORK"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

awk '/^prepare_ai_profile_prompt\(\)/ { inside = 1 }
     inside { print }
     inside && /^}$/ { exit }' "$ENTRYPOINT" > "$WORK/function.sh"
awk '/^validate_ai_configuration_manifest\(\)/ { inside = 1 }
     inside { print }
     inside && /^}$/ { exit }' "$ENTRYPOINT" >> "$WORK/function.sh"
grep -q 'prepare_ai_profile_prompt()' "$WORK/function.sh"
grep -q 'validate_ai_configuration_manifest()' "$WORK/function.sh"
# shellcheck source=/dev/null
source "$WORK/function.sh"
log() { printf '[spec] %s\n' "$*"; }

cat > "$WORK/valid.json" <<'JSON'
{"harness":"Pi","items":[{"id":"context-mode","kind":"Plugin","source":"npm:context-mode@1.0.169","origin":"Global","enabled":true,"imageBaked":true}]}
JSON
DIRECT_AI_CONFIGURATION_MANIFEST="$WORK/valid.json" validate_ai_configuration_manifest

cat > "$WORK/secret.json" <<'JSON'
{"harness":"Pi","items":[{"id":"context-mode","kind":"Plugin","source":"npm:context-mode@1.0.169","origin":"Global","enabled":true,"imageBaked":true,"apiKey":"must-not-travel"}]}
JSON
if (DIRECT_AI_CONFIGURATION_MANIFEST="$WORK/secret.json" validate_ai_configuration_manifest 2>/dev/null); then
    echo 'A secret-shaped manifest was accepted' >&2
    exit 1
fi

mkdir -p "$WORK/workspace/.cratis" "$WORK/profiles"
cat > "$WORK/workspace/.cratis/ai.json" <<'JSON'
{"profiles":["cratis/documentation"]}
JSON
cat > "$WORK/profiles/ai-profile-cratis-documentation.md" <<'EOF'
documentation-profile
EOF
cat > "$WORK/profiles/ai-profile-cratis-engineering-csharp.md" <<'EOF'
csharp-profile
EOF
cat > "$WORK/profiles.json" <<'JSON'
{"harness":"Pi","items":[{"id":"cratis/documentation","kind":"Profile","source":"cratis-ai:revision:cratis/documentation","origin":"Global","enabled":true,"imageBaked":false},{"id":"cratis/engineering/csharp","kind":"Profile","source":"cratis-ai:revision:cratis/engineering/csharp","origin":"Global","enabled":true,"imageBaked":false}]}
JSON
DIRECT_AI_CONFIGURATION_MANIFEST="$WORK/profiles.json"
DIRECT_AI_PROFILE_DIRECTORY="$WORK/profiles"
DIRECT_WORKSPACE_ROOT="$WORK/workspace"
prepare_ai_profile_prompt
grep -q 'csharp-profile' "$DIRECT_AI_PROFILE_PROMPT_FILE"
if grep -q 'documentation-profile' "$DIRECT_AI_PROFILE_PROMPT_FILE"; then
    echo 'A repository-owned profile was duplicated by Global configuration' >&2
    exit 1
fi

printf 'Checked valid, secret-bearing, and repository-overridden AI configuration manifests.\n'
