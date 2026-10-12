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
| `Cratis/Lens` `Source/` | `v0.0.1`, manifest `1.0.0` | The extension itself; no newer release |
| `Cratis.Arc.Core` | `22.75.0` | The `/.cratis/*` endpoints, the forwarded-identity contract, and the tenancy header Lens depends on |

Behavior was read at Lens `v0.0.1` and `main`; the Source diff is metadata/build
packaging only. The release predates the previously verified `3ee4882` commit.
Arc evidence: [ArcOptions.cs:61–80](https://github.com/Cratis/Arc/blob/v22.75.0/Source/DotNET/Arc.Core/ArcOptions.cs#L61-L80),
[MicrosoftIdentityPlatformAuthenticationHandler.cs:28–40](https://github.com/Cratis/Arc/blob/v22.75.0/Source/DotNET/Arc.Core/Identity/MicrosoftIdentityPlatformAuthenticationHandler.cs#L28-L40),
[IntrospectionOptions.cs](https://github.com/Cratis/Arc/blob/v22.75.0/Source/DotNET/Arc.Core/Introspection/IntrospectionOptions.cs)
and [DiscoveryExposure.cs:102–138](https://github.com/Cratis/Arc/blob/v22.75.0/Source/DotNET/Arc.Core/Introspection/DiscoveryExposure.cs#L102-L138).

⚠️ **There is no published store listing.** Nothing in the Lens repository links
a Chrome Web Store, Edge Add-ons, AMO, or App Store entry — the only store URLs
present are developer-console links inside its own publishing guide. Building
from source and loading unpacked is the only install path that exists.

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

On `main`, `yarn build-package` runs `scripts/build-package.js` and writes zip
packages into repo-root `dist/`; the manifest description changed, but the name
is still **Cratis Lens**. At `v0.0.1` the script instead zips to `lens-extension.zip`.

The code uses the `chrome.*` namespace throughout with no polyfill. The release
workflow also packages for Edge, Firefox and Safari, but no cross-browser
behavior is tested; treat Chromium as the supported target.

## What the Arc application must already provide

Lens is not self-contained. It reads endpoints Arc maps for itself, and it sends
headers Arc's shipped identity handler reads only after host opt-in. There is no
Lens-specific package or middleware. For local impersonation, the development
host must set `Cratis:Arc:TrustForwardedIdentityHeaders=true` (default **false**).
Never enable this on an exposed application without a trusted ingress that
strips client-supplied identity headers.

| Route | Mapped by | Lens uses it for |
| --- | --- | --- |
| `GET /.cratis/commands` | `MapIntrospectionEndpoints`, discovery access policy | The Commands tree |
| `GET /.cratis/queries` | `MapIntrospectionEndpoints`, discovery access policy | The Queries tree |
| `GET /.cratis/users` | every `ICanProvideUsers`, identity discovery policy | The importable user roster |
| `GET /.cratis/tenants` | every `ICanProvideTenants`, identity discovery policy | The importable tenant list |
| `GET /.cratis/identity-details/schema` | the identity endpoint mapper | The schema-driven editor for a user's `identityDetails` |

At Arc v22.75.0 discovery is anonymous by default **only in Development**.
Against a deployed host Lens needs the user signed in; hosts unable to authenticate
omit those routes (404). `Introspection.Enabled` controls catalogs and
`IdentityDiscovery` the roster/tenant/schema routes. Forwarded identity switching
also needs the explicit host-wide `TrustForwardedIdentityHeaders` opt-in, only
behind a header-stripping ingress. Source:
[secure defaults](https://github.com/Cratis/Arc/blob/v22.75.0/Documentation/upgrading/secure-defaults.mdx).
`MapIntrospectionEndpoints` runs during Arc activation, subject to these settings. The user and tenant
routes return whatever the application implements — with **no implementation
registered they return an empty list**, and Lens treats a `404` on either as
"empty", not "broken". Users and tenants can also be created by hand in Lens's
Settings, so an application that provides neither still works.

At Arc `22.75.0`, all five discovery routes are anonymous by default only in
**Development**. Elsewhere they require authentication, or are not mapped when
the host cannot enforce it. `Cratis:Arc:Introspection` options `Enabled` and
`IdentityDiscovery` control mapping; `RequireAuthentication` and `Roles` control
access. Register development user/tenant providers with fixtures, not production
rosters — see `cratis-arc-authentication-authorization-and-identity`.

### Identity

Lens sends exactly three forwarded client-principal headers. Arc ignores them
and treats the request as anonymous unless
`Cratis:Arc:TrustForwardedIdentityHeaders=true`; a default Arc app therefore
does not honor Lens identity switching:

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
Lens at manifest `1.0.0` (`3ee4882`)** without editing `chrome.storage.local` by hand. Guidance describing
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

At Arc v22.75.0 the backend neither reads nor writes that legacy identity
cookie. Lens still deletes it for older hosts; reloading clears the frontend's
in-memory identity and asks `/.cratis/me` again. Header-based switching requires
the host-wide trust opt-in and a suitable development/ingress boundary; the
extension cannot turn unsigned headers into authenticated credentials.

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

⚠️ **The schema-driven payload form does not receive a schema from
Arc `22.75.0`.** Lens reads an optional property named `schema` off each introspection
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
authentication in front of `/.cratis/commands` and `/.cratis/queries` breaks
those tabs while Settings may keep working. This is the default outside
Development at Arc `22.75.0`. Run the app in **Development**, or knowingly set
`Cratis:Arc:Introspection:RequireAuthentication=false` on an isolated development
host; do not weaken production discovery for Lens.
Evidence: [Lens introspection.ts:100–131](https://github.com/Cratis/Lens/blob/v0.0.1/Source/arc/introspection.ts#L100-L131).

Queries are path-parameter GETs only: no query-string arguments, no paging or
sorting inputs, and no observable subscription from the popup.

## Query diagnostics

The Query Diagnostics tab is read-only and polls every 2 seconds. It requires the
detected Arc context to expose `observableQueryDiagnostics.getSnapshot()`; when
it does not, the panel reports no data. Nothing else in Lens depends on it.

## Verify

- `yarn ci` is clean, and Chrome loaded `Source/dist` without errors.
- The development application answers `/.cratis/commands` and `/.cratis/queries`
  anonymously under its deliberate discovery exposure policy.
- The isolated development host enables `Cratis:Arc:TrustForwardedIdentityHeaders`;
  without it, Lens's forwarded identity remains anonymous.
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
- Executing an existing command from backend code without the extension: `cratis-arc-command-execution`.
- Observable query transports and their HTTP shapes: `cratis-arc-observable-query-http`.
- Inspecting a Chronicle event store: the Chronicle CLI or Workbench guidance.
