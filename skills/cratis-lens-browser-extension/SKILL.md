---
name: cratis-lens-browser-extension
description: Use the Cratis Lens browser extension against a running Cratis Arc application — building and side-loading it, what the Arc app must already serve for Lens to work, switching the active user and tenant, and executing a command or query from the popup. Use when setting Lens up, when Lens does not detect an Arc app, or when a switched identity or tenant does not take effect. Do not use for production authentication or authorization design, and do not use for Chronicle inspection.
license: MIT
---

# Use Lens against a running Arc application

Lens is a Manifest V3 browser extension that impersonates a user and a tenant
against an Arc application you are developing, and executes that application's
commands and queries from a popup. It changes nothing in the application: it
rewrites request headers at the network boundary and reads Arc's own
introspection endpoints.

⚠️ Lens is a **development** tool that can present any identity to any origin
the developer points it at. Nothing in it is production tooling.

## Verified product sources

| Source | Version | Purpose |
| --- | --- | --- |
| `Cratis/Lens` `Source/` | manifest `1.0.0`, repository revision `3d0df87` | The extension itself |
| `Cratis.Arc.Core` | `22.10.4` | The `/.cratis/*` endpoints, the forwarded-identity contract, and the tenancy header Lens depends on |

⚠️ **There is no published store listing.** Nothing in the Lens repository links
a Chrome Web Store, Edge Add-ons, AMO, or App Store entry — the only store URLs
present are developer-console links inside its own publishing guide. Building
from source and loading unpacked is the only install path that exists.

## Install

```bash
cd Source
yarn install
yarn build          # writes the unpacked extension to Source/dist/
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load
unpacked**, and select `Source/dist`. Chrome lists it as **Cratis Lens** — the
name in `manifest.json`; the repository's own tutorial calls it "Lens - Cratis
Developer Tools", which is stale.

`yarn dev` is `vite build --watch`; the extension still has to be reloaded in
Chrome after each rebuild. `yarn ci` runs `typecheck`, `test` and `build` — the
same three the pull-request workflow runs. There is no lint script.

The code uses the `chrome.*` namespace throughout with no polyfill. The release
workflow also packages for Edge, Firefox and Safari, but no cross-browser
behavior is tested; treat Chromium as the supported target.

## What the Arc application must already provide

Lens is not self-contained. It reads endpoints Arc maps for itself, and it sends
headers Arc's shipped identity handler already reads. **No NuGet package,
middleware, `Program.cs` change, or configuration key exists for "Lens support"
— nothing in either repository names one.**

| Route | Mapped by | Lens uses it for |
| --- | --- | --- |
| `GET /.cratis/commands` | `MapIntrospectionEndpoints`, `AllowAnonymous` | The Commands tree |
| `GET /.cratis/queries` | `MapIntrospectionEndpoints`, `AllowAnonymous` | The Queries tree |
| `GET /.cratis/users` | every `ICanProvideUsers`, `AllowAnonymous` | The importable user roster |
| `GET /.cratis/tenants` | every `ICanProvideTenants`, `AllowAnonymous` | The importable tenant list |
| `GET /.cratis/identity-details/schema` | the identity endpoint mapper | The schema-driven editor for a user's `identityDetails` |

`MapIntrospectionEndpoints` is called from Arc's own application startup, so the
two introspection routes exist without being asked for. The user and tenant
routes return whatever the application implements — with **no implementation
registered they return an empty list**, and Lens treats a `404` on either as
"empty", not "broken". Users and tenants can also be created by hand in Lens's
Settings, so an application that provides neither still works.

⚠️ `/.cratis/users` and `/.cratis/tenants` are mapped `AllowAnonymous` and
**unconditionally**. Register `ICanProvideUsers`/`ICanProvideTenants` only for a
development environment and return fixtures — see
`cratis-arc-authentication-authorization-and-identity`.

### Identity

Lens sends exactly the three forwarded client-principal headers Arc's shipped
handler reads:

```text
X-MS-CLIENT-PRINCIPAL-ID
X-MS-CLIENT-PRINCIPAL-NAME
X-MS-CLIENT-PRINCIPAL      # base64 of the principal JSON
```

The principal document it base64-encodes is
`{ identityProvider, userId, userDetails, userRoles, claims: [{ typ, val }], … }`
with the user's `identityDetails` and `applicationProperties` spread over it.
`identityProvider` defaults to `aad` and `userRoles` falls back to
`["authenticated", "anonymous"]` when the user has no roles.

⚠️ That is Lens's **only** identity mode. There is no bearer token, no OIDC, no
sign-in. The application has to be running on the Microsoft-Identity-Platform
forwarded-header path, and the reverse proxy in front of it in production must
be the only thing that can set those headers.

### Tenancy

Lens sets one header, named by its `tenantHeaderName` setting, whose default is
`x-cratis-tenant-id`. That matches `TenancyOptions.HttpHeader`'s default, and
`TenantResolverType.Header` is Arc's default resolver — so a default Arc
application needs no change.

⚠️ **`tenantHeaderName` has no user interface.** It is a stored setting with a
default and nothing binds it to an input. An application that resolves tenancy
by query parameter, claim, subdomain, or a renamed header **cannot be driven by
Lens today** without editing `chrome.storage.local` by hand. Guidance describing
a "Tenant Header Name" field on an options page is describing something that
does not exist — there is no `options_page` in the manifest at all.

### The frontend

Detection is not header-level and is not invisible. Lens injects a function into
the page's main world and looks for:

1. an element with `id="root"`;
2. a React fiber or container key on it (`__reactFiber…` / `__reactContainer…`);
3. a context value on the fiber tree carrying either a `reconnectQueries`
   property, or a `configuration` object with one of `baseUrl`, `apiBaseUrl`,
   `apiSurface`, `apiSurfaceBaseUrl`, `baseUri` or `baseAddress`.

If that fails it falls back to matching the path
`/projects/{guid}/application/{guid}`, and otherwise to the host being
`localhost` or `127.0.0.1`.

⚠️ A non-React frontend, a root element with another id, or a React version that
renames its internal fiber keys leaves Lens undetected — the Commands, Queries
and Query Diagnostics tabs are then **disabled**, and only Context and Settings
work. The detected base URL is also what the Commands and Queries tabs call, so
without detection there is nothing to call.

## Switch the active user or tenant

Pick both on the **Context** tab. Two things then happen, in this order:

1. The service worker rebuilds its `declarativeNetRequest` **dynamic** rules —
   at most two, one for the identity headers and one for the tenant header.
2. It deletes the Arc identity cookie `.cratis-identity` on the detected base URL
   and page origins, then reloads every open tab on those origins.

Step 2 is the one that matters. Headers alone do not change who you are once Arc
has issued its identity cookie; the application keeps presenting the identity it
was first given. Dropping the cookie and reloading is what makes the switch take
effect.

The rules are scoped, deliberately. When a page origin is known the condition is
`{ urlFilter: '*', initiatorDomains: [<page host>] }`; otherwise it is
`||<base URL host>`. **With neither resolvable, no rules are installed at all** —
`host_permissions` is `<all_urls>`, so a wildcard filter would attach
impersonation headers to every XHR on every site the developer browses.

⚠️ The rules match `XMLHTTPREQUEST` **only**. Document navigations, WebSocket
connections and EventSource/SSE streams carry no injected headers. Arc's
observable-query transports (`/.cratis/queries/ws`, `/.cratis/queries/sse`) are
therefore **not** covered by header injection.

## Execute a command or query

The Commands and Queries tabs read the introspection lists and group them into a
tree by splitting the namespace on `.`.

A command is always `POST <base URL><route>` with `Content-Type: application/json`
and the active context headers, and a body built by the schema-driven editor. A
query is always `GET`, with `{name}` segments in the route substituted from the
path-parameter inputs and the same context headers.

⚠️ **The schema-driven payload form does not currently receive a schema from
Arc.** Lens reads an optional property named `schema` off each introspection
item, and falls back to trying `/.cratis/types/{type}`, `/.cratis/schema/{type}`,
`/.cratis/schemas/{type}` and `/.cratis/types?type={type}` in turn. Arc names the
property **`payloadSchema`** on a command and **`argumentsSchema`** on a query,
and maps none of those four fallback routes. Every branch therefore misses, and
the panel shows *"No payload schema available. Lens will execute this command
with an empty payload object."*

There is **no raw-JSON editor** behind that empty state, so a command reached
this way can only be fired with `{}`. Expect that for every command until the two
sides agree on a property name; do not read it as a broken application. Queries
are unaffected — their inputs come from the `{name}` segments of the route, not
from a schema.

Both result panels parse defensively rather than against a contract: success is
`isSuccess` when present and HTTP 2xx otherwise, messages are harvested from
`exceptionMessages`/`errors`/`message`/`title`/`detail`, and a query payload is
unwrapped from the first of `data`, `result`, `items`, `results`, `value`,
`payload` or `content` that is present.

⚠️ **The two introspection fetches send no headers and no credentials**, while
the Settings user/tenant refresh does send both. So an application that puts
authorization in front of `/.cratis/commands` breaks the Commands and Queries
tabs while Settings keeps working — which reads as a mysterious partial failure.
Leave those two routes anonymous.

Queries are path-parameter GETs only: no query-string arguments, no paging or
sorting inputs, and no observable subscription from the popup.

## Query diagnostics

The Query Diagnostics tab is read-only and polls every 2 seconds. It requires the
detected Arc context to expose `observableQueryDiagnostics.getSnapshot()`; when
it does not, the panel reports no data. Nothing else in Lens depends on it.

## Safety

The manifest asks for `storage`, `scripting`, `cookies`, `declarativeNetRequest`,
`declarativeNetRequestWithHostAccess` and `<all_urls>`. That combination lets the
extension present a chosen identity to any origin, read and delete cookies, and
inject into any page.

- Keep it out of a browser profile used for anything but development.
- The user roster, including claims, is stored unencrypted in
  `chrome.storage.local`.
- An application reachable outside a developer's machine while trusting the
  forwarded headers is impersonatable by anyone who can set them. Lens does not
  create that exposure — it demonstrates it.

## Verify

- `yarn ci` is clean, and Chrome loaded `Source/dist` without errors.
- The application answers `/.cratis/commands` and `/.cratis/queries`
  anonymously.
- Tenancy resolves from the header and the header is named
  `x-cratis-tenant-id`.
- Opening the popup on the app's tab enables the Commands tab — that is the
  detection signal.
- After switching a user, the tab reloaded and the application reports the new
  identity, not the previous one.
- Development user and tenant providers, if registered at all, return fixtures.

## Route near misses

- Designing authentication, authorization, identity details or tenancy in the
  application: `cratis-arc-authentication-authorization-and-identity`.
- Calling a command over HTTP without the extension: `cratis-arc-command-execution`.
- Observable query transports and their HTTP shapes: `cratis-arc-observable-query-http`.
- Inspecting a Chronicle event store: the Chronicle CLI or Workbench guidance.
