#!/usr/bin/env bash
#
# Register the Planner's GitHub App under an organization and print the configuration it needs.
#
# Why a script rather than `gh`: a GitHub App cannot be created through the REST API at all. The only
# non-interactive-ish path GitHub offers is the App *manifest* flow, which has to round-trip through a
# browser so a human approves the creation. This script drives that flow end to end - it fetches the
# manifest from the running Planner, serves it pre-filled, catches the redirect, exchanges the
# temporary code for the App's credentials and prints them. You click "Create GitHub App".
#
# The manifest is fetched from the Planner rather than embedded here on purpose: the permissions and
# webhook events live in exactly one place (Source/Planner/GitHub/App/GitHubAppManifest.cs), so this
# script can never drift from what the Planner actually asks for.
#
# Usage:
#   PLANNER_URL=https://planner.example.com ./scripts/create-github-app.sh
#
# Optional:
#   ORG=...          the organization to register the App under (default "Cratis"; empty for a personal App)
#   APP_NAME=...     the App's name (default "Cratis Planner"; GitHub requires it to be globally unique)
#   PORT=...         the local port the redirect is caught on (default 8732)
#   OUT=...          write the settings to this file as well as printing them

set -euo pipefail

ORG="${ORG-Cratis}"
PORT="${PORT:-8732}"
APP_NAME="${APP_NAME:-}"
OUT="${OUT:-}"

if [[ -z "${PLANNER_URL:-}" ]]; then
    echo "PLANNER_URL must be set to the Planner's publicly reachable base URL - GitHub builds the" >&2
    echo "webhook and callback URLs from it, so an address only reachable inside the cluster will not work." >&2
    exit 1
fi

command -v python3 >/dev/null || { echo "python3 is required." >&2; exit 1; }
command -v curl    >/dev/null || { echo "curl is required."    >&2; exit 1; }

PLANNER_URL="${PLANNER_URL%/}"

echo "Fetching the App manifest from ${PLANNER_URL}…"
MANIFEST=$(curl -fsS "${PLANNER_URL}/github-app/manifest?name=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$APP_NAME")") || {
    echo "Could not reach ${PLANNER_URL}/github-app/manifest." >&2
    echo "Start the Planner (or point PLANNER_URL at the running one) and try again." >&2
    exit 1
}

if [[ -n "$ORG" ]]; then
    echo "Registering the App under organization '${ORG}'."
else
    echo "Registering the App under your personal account (ORG is empty)."
fi
echo "A browser window will open. Approve the creation on GitHub."
echo

APP_ORG="$ORG" APP_PORT="$PORT" APP_MANIFEST="$MANIFEST" APP_OUT="$OUT" python3 - <<'PY'
import html
import http.server
import json
import os
import socketserver
import threading
import urllib.request
import webbrowser
from urllib.parse import urlparse, parse_qs

org = os.environ["APP_ORG"]
port = int(os.environ["APP_PORT"])
out = os.environ["APP_OUT"]
manifest = json.loads(os.environ["APP_MANIFEST"])

# The Planner's manifest redirects to its own /github-app/created, which shows the settings in a
# browser. Driving the flow from a terminal means catching the redirect here instead, so the
# credentials land in the shell that is going to store them.
manifest["redirect_url"] = f"http://localhost:{port}/callback"

action = (
    f"https://github.com/organizations/{html.escape(org)}/settings/apps/new"
    if org
    else "https://github.com/settings/apps/new"
)

form = f"""<!doctype html><html><body onload="document.forms[0].submit()">
<p>Redirecting to GitHub to create the App…</p>
<form action="{action}" method="post">
<input type="hidden" name="manifest" value='{html.escape(json.dumps(manifest))}'>
<noscript><button type="submit">Continue to GitHub</button></noscript>
</form></body></html>"""

result = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if not self.path.startswith("/callback"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(form.encode())
            return

        code = parse_qs(urlparse(self.path).query).get("code", [None])[0]
        if not code:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"No code in redirect.")
            return

        # The temporary code is itself the authentication for this call, and it expires in an hour.
        request = urllib.request.Request(
            f"https://api.github.com/app-manifests/{code}/conversions",
            method="POST",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "cratis-planner-setup"},
        )
        with urllib.request.urlopen(request) as response:
            result.update(json.load(response))

        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(
            f"<h2>App '{html.escape(result['name'])}' created.</h2>"
            "<p>Return to the terminal for the settings, then install the App.</p>".encode()
        )
        threading.Thread(target=self.server.shutdown, daemon=True).start()


with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
    webbrowser.open(f"http://localhost:{port}/")
    print(f"If no browser opened, visit http://localhost:{port}/")
    httpd.serve_forever()

if not result:
    raise SystemExit("App creation was not completed.")

owner = result.get("owner", {}).get("login", org)
settings = "\n".join([
    f"Planner__GitHubApp__AppId={result['id']}",
    f"Planner__GitHubApp__Slug={result['slug']}",
    f"Planner__GitHubApp__Name={result['name']}",
    f"Planner__GitHubApp__Organization={owner}",
    f"Planner__GitHubApp__WebhookSecret={result.get('webhook_secret', '')}",
    "Planner__GitHubApp__PrivateKeyPem=" + result["pem"].replace("\n", "\\n"),
])

print()
print("App created. Set these as configuration - environment variables, `dotnet user-secrets` locally,")
print("or a Kubernetes secret in production - and restart the Planner:")
print()
print(settings)
print()
if owner:
    print(f"Then install it: https://github.com/organizations/{owner}/settings/apps/{result['slug']}/installations")
else:
    print(f"Then install it: {result['html_url']}/installations/new")

if out:
    with open(out, "w", encoding="utf-8") as file:
        file.write(settings + "\n")
    print()
    print(f"Also written to {out} - it holds the App's private key, so treat it as a secret.")
PY
