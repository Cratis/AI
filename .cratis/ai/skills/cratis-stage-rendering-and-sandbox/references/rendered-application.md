# The rendered application: scaffold, managed files and `Customizations/`

## Contents

- Scaffold
- Runtime package migration
- Lists on screen
- Reducer layout for new applications
- Authentication and onboarding
- What is managed
- `Customizations/` (unmanaged)
- Re-render checklist

## Scaffold

The scaffold pins an exact release of every dependency (Arc, Chronicle client and kernel
image, Cratis Components, Scene, Fundamentals, Vite and React). The pins belong to the
renderer: read them from the rendered `.csproj`, `docker-compose.yml` and `package.json`, never
from this skill. Moving them is a renderer change, so a re-render
under a newer Stage is how they change; never bump a managed file.
Requires Stage 4.144.0 for backend pins derived at build time from Stage's central
package versions and shared frontend pins following Stage's frontend manifest;
older renderers use separately maintained scaffold pins. Regeneration updates
existing applications; it does not float dependencies in an already rendered app.

| Item | Value |
| --- | --- |
| Target framework | .NET 10 (`net10.0`), `Microsoft.NET.Sdk.Web` |
| Chronicle image | The compose file runs the `cratis/chronicle` development image matching the pinned client |
| Embedded reverse extraction | `CratisEmbeddedScreenplayEnabled=false`: the source `.play` is authoritative |
| Test packages | Cratis specifications, xunit and test SDK; **Debug configuration only** (`IsTestProject` when Debug) |
| Package management | central package management **off**; `Directory.Packages.props` is managed, do not edit it |

The Scene family in the frontend is six packages: `@cratis/scene.blueprint.default`,
`@cratis/scene.components`, `@cratis/scene.engine`, `@cratis/scene.model`,
`@cratis/scene.primereact` and `@cratis/scene.react`. `@cratis/scene` is **not** a package
in this family. Read [Scene runtime](scene-runtime.md) when distinguishing the runtime
from a hand-built Components page. The scaffold's Components pin is independent of the
newest Components release.

Consequences: `[ProtectedDecision]` (`Cratis.Arc.Chronicle.ReadModels`) and
`DecisionRead<T>` / `IDecisionReads` (`Cratis.Chronicle.ReadModels`) are available
in the scaffold's package set, as is `[ExecuteCommandsAsSystem]`. This is API
availability, not Stage emission or runtime protection: gap-fill must opt into
the protected command profile and enroll an admitted projection/key read in the
active unit of work. Requires Stage 4.138.0 for Cratis C# rendering of admitted
`.play` protected reads as Arc read protection; older renderers refuse them with
`STAGE-ESM-044`, as do shapes the renderer cannot preserve. Semantic Host/executor
support is separate from generated-application protection.
Hand-written scope that needs a newer dependency can raise its version through
`Customizations/Dependencies.props` (explicit `Version`, imported last; central management
is off), but any override must be proven with a restore and build. The compose file binds local ports `27017` and
`35000`, keeps data in the named volumes `chronicle-data` and `chronicle-config`, and
`docker compose down --volumes` is the only thing that deletes them.

## Runtime package migration

Stage v4.180.0 and later generate a dependency on `@cratis/stage.runtime`, pinned
to the rendering Stage release, rather than copied frontend runtime files.
Re-render existing applications: unchanged old copies are removed; edited copies
stop the migration until resolved. See [runtime and reducer migration](current-boundaries.md#runtime-package-and-reducer-migration).

## Lists on screen

A `data <ReadModel>[] via query <Query>` list renders from either list-query mode, but
`observable` renders `Observe<T>()` and a first-result wait, while a snapshot renders a one-shot
`GetInstances<T>()`. Declare `query <Name> => observable <ReadModel>[]` for any list a person watches change.
Run `cratis render --check` first (`references/admission.md`) to catch refusals before a real render.

## Reducer layout for new applications

Requires Stage 4.128.0 for the Cratis C# self-reducing profile; older renderers emit
separate `IReducerFor<T>` classes. Existing `CreateProfile` callers remain classic;
a missing destination/configuration file does not identify a new application.
For a **confirmed new application**, artifact-planning hosts opt in explicitly:

```csharp excerpt
var profile = CratisRendering.CreateNewApplicationProfile(
    "Shop", new("Shop.Backend", "Acme.Shop"));
```

This API is in `Cratis.Stage.Rendering.Cratis`. Pass the profile to scaffold and
artifact planning through `CratisPlanOptions.Profile`. The scaffold persists
`.cratis/stage/rendering.json` with exactly
`{"version":1,"application":"Shop","reducerConvention":"self"}`. On later renders,
the host reads that file and restores the input; Stage does not search the destination:

```csharp excerpt
var input = ReducerConventionInput.Read("Shop", configurationJson);
var profile = CratisRendering.WithReducerConvention(
    CratisRendering.CreateProfile("Shop", new("Shop.Backend", "Acme.Shop")), input);
```

`configurationJson` is the host-supplied file content. Invalid version, application,
fields or convention are refused, not defaulted. Self mode emits public static
`Reduce` overloads and non-public typed-context helpers on the read-model record,
with unchanged queries and no companion `IReducerFor<T>`. StateView and Automation
slices use the layout; observer filters become model attributes. Existing purity,
identity, tenant, deletion and occurrence semantics remain. Model/property/query
name `Reduce`, replay-hook query names, or generated `Transition_<suffix>` collisions
refuse `STAGE-ESM-019`; Stage never silently changes layout.

No per-model override or existing-application migration is supported. Do not flip
an existing classic application to `self`: observer identity and old reducer removal
need migration-aware publication. This opt-in does not automatically change CLI,
Studio or semantic-engine execution.

## Authentication and onboarding

A model with an `authentication` block renders an application that runs behind AuthProxy
and trusts the identity it forwards. The model's `onboarding` block renders the code that
acts on the outcomes of the application's own Ante. Both are realized by the renderer;
none of it is hand-written gap-fill.

Requires cratis CLI 3.116.0 with Stage 4.211.0 (`cratis --version`); older releases report `authentication` and `onboarding` as unrendered warnings.

| Rendered | Purpose |
| --- | --- |
| `appsettings.json` with `Cratis:Arc:TrustForwardedIdentityHeaders` true | Arc builds the caller from the headers AuthProxy forwards. |
| `GeneratedAuthentication/` (`Personas`, `MemberIdentity`, `RuntimeConventions`) | Roles and claims per persona, the identity of a person, and the Chronicle connection string read from `CRATIS_CHRONICLE_CONNECTION_STRING_FILE`. |
| `GeneratedOnboarding/` | Reactor on Ante's outcomes, idempotent provisioning, the invite-member command, member persona claims, Herald email sending. |
| `Emails/` | Email templates and images laid out for Herald. |
| `.runtime/authproxy.application.json`, `.runtime/ante.onboarding.json`, `.runtime/environment.json` | What a runtime (`cratis run`, Stage Manager) starts AuthProxy and Ante with, and the environment keys the model needs. |

- The identity headers are unsigned. Never expose a rendered application with authentication
  except through AuthProxy.
- Only provider kinds AuthProxy supports render (`EntraId`, `GitHub`, `Google`, `Apple`,
  `OpenId`). Another kind is left out with `STAGE-AUTH-001`; a persona that is not a
  requirement on authentication, roles or claims is never matched (`STAGE-AUTH-002`).
- `offering` renders nothing (`STAGE-ONBOARDING-001`): tenants are provisioned without
  licensing. `STAGE-ONBOARDING-002` to `-006` cover a tenant invitation with no command,
  a sign-up without a first-member persona, a legal document count other than two, a
  missing email template and an invitation without inviters.
- An invitation Ante rejects (a persona or invitation type the model does not allow) is a
  mistake in the invitation, not a decision about the person: the application records
  `OnboardingInvitationRejected` and logs a warning for an administrator, and emails no
  one. The `signupDeclined` template renders but is not sent until Ante publishes a
  declined sign-up (`STAGE-ONBOARDING-007`).
- An application with onboarding pins a newer Chronicle client and kernel image than
  other applications; read them from the rendered files.
- Realization needs the model folder: email images are read from the model root.

Read the Stage references `authentication-rendering.md` and `onboarding-rendering.md` for
exact files and keys.

## What is managed

Every path in `.cratis-render.json` is managed: the scaffold files (project, solution,
`Program.cs`, `GeneratedPolicyRegistration.cs`, `appsettings.json`, `docker-compose.yml`,
the three `Directory.*` files, `package.json`, `tsconfig.json`, `.gitignore`,
`.frontend/*`), `scene.json`, `src/bindings.ts` and everything rendered from the model
(concepts, slice folders, policies, Debug specifications). Editing any of them is lost or
refused on the next render. The application identity from `--name` becomes the
Chronicle event-store name in `appsettings.json` and the default project name and root
namespace.

Whether modeled `screen` declarations become faithful screens is a runtime question, not a
publication result: the scaffold emits Arc `CommandForm` shells over Scene typed
bindings and navigation contributions, but claim UI fidelity only from a browser run
(SKILL.md, "UI parity"). Screens stay managed.

## `Customizations/` (unmanaged)

The top-level `Customizations/` folder is reserved and user-owned. No plan contains a path
there (a module or feature that would render into it fails with `STAGE-CRATIS-005`), and
the planner never reads it, so it can neither break nor repair a render.

| File | Use | Picked up when |
| --- | --- | --- |
| `Customizations/Program.cs` | Service registrations, options, extra endpoints or middleware, through the partial methods `ConfigureServices(WebApplicationBuilder)` and `ConfigureApplication(WebApplication)` | the project compiles |
| `Customizations/*.cs` | Adapters and other types | the project compiles |
| `Customizations/Dependencies.props` | Project and package references, MSBuild properties; imported last | MSBuild evaluates the project |
| `Customizations/styles.css` | Font and `--cratis-*` token overrides | Vite builds or serves the frontend |

Every file is optional. Rules that bite:

- `Customizations/Program.cs` stays in the global namespace and declares
  `partial class Program` with exactly the managed signatures (`static partial void ...`);
  a namespace or a changed signature fails with `CS0759`.
- `ConfigureServices` runs after `AddCratis` and before `Build`; `ConfigureApplication`
  runs last, after the generated middleware and endpoints. The last registration of a
  service wins, so do not re-register Cratis types unless you mean to replace them.
- Configuration comes from environment variables or other sources, not from
  `appsettings.json` (managed). Keep secrets out of files under `Customizations/`.
- A `PackageReference` in `Dependencies.props` needs an explicit `Version`.
- Endpoints sit under `/api` (the Vite dev server proxies it) on a path that cannot collide
  with a route Arc generates.
- `package.json` is managed, so `styles.css` cannot add npm dependencies. Restart the dev
  server after creating or deleting the file.
- Mapped endpoints are anonymous unless secured with ASP.NET Core authorization;
  modeled authorization covers only what Stage renders.

What the seam does **not** do: it repairs no rejected model and renders nothing.
Stage renders supported event-triggered Automation slices as managed Chronicle
reactors; bounded source-event capture and outbound Translate paths also render. Refused reaction or Translate shapes remain hand-written gap-fill
with the model as their contract. See [admission.md](admission.md). Keep `Customizations/` under version control: whether a re-render keeps
it depends on the publisher, and `cratis render` writes only the planned paths and
refuses unmanaged files at them.

## Re-render checklist

1. Commit or stash local work; `Customizations/` is untracked by Stage, not protected by it.
2. Render from the same model folder with the same `--name` and `--destination`.
3. On a refusal for a modified managed file, find out why it was edited. Move the intent
   into the model or `Customizations/`, then re-render; use `--force` only to discard the
   edit on purpose.
4. A result with `recovered: true` stops the work until the destination is reconciled.
5. Build and test in Debug (separate results); do not infer them from the render.
