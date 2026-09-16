# AI Corpus Profiles

Profiles determine which rules and skills apply to your work. They define the scope of the AI corpus and which documentation, conventions, and skills are available.

## Two Main Profile Types

### Application Profile

**Use when:** You are building an application on Cratis.

**What it includes:**
- Event-sourced CQRS with **Cratis Chronicle** + **Cratis Arc**
- Vertical slices (commands, events, projections, read models)
- React + Cratis Components (PrimeReact) frontend in MVVM
- MongoDB or EF Core for read models
- Full-stack type safety from C# to TypeScript

**Key rules:**
- [vertical-slices.md](./vertical-slices.md) - slice anatomy and structure
- [react.md](./react.md) - React + Arc + Cratis Components
- [components.md](./components.md) - component structure and styling
- [dialogs.md](./dialogs.md) - dialog patterns
- [specs.scenarios.csharp.md](./specs.scenarios.csharp.md) - in-process scenario family

### Framework Profile

**Use when:** You are contributing to a Cratis framework repository itself (Arc, Chronicle, Fundamentals, Components, Specifications).

**What it includes:**
- Library development (not applications)
- Source generators, the Chronicle kernel (Orleans grains + storage), client SDKs, React component library
- No vertical slices, no model-bound `[Command]`/`[ReadModel]` artifacts
- No projections/read-models, no MVVM app components

**Key rules:**
- [framework.md](./framework.md) - repo structure and library/API design
- [orleans.md](./orleans.md) - Orleans grain conventions
- [specs.csharp.md](./specs.csharp.md) - universal `Specification` base + NSubstitute

## Profile Catalog

The complete list of available profiles is defined in [profile-catalog.json](../profile-catalog.json). This catalog includes:

### Application Profiles

| Profile ID | Description |
|---|---|
| `cratis/application` | Full application stack (C# + React + TypeScript) |
| `cratis/application/csharp` | C# backend with Arc + Chronicle |
| `cratis/application/react` | React frontend with Cratis Components |
| `cratis/application/typescript` | TypeScript client for Chronicle |
| `cratis/application/arc-chronicle` | Arc + Chronicle integration |
| `cratis/application/arc-only` | Arc without Chronicle |
| `cratis/application/chronicle-dotnet` | Chronicle .NET client |
| `cratis/application/elixir` | Elixir Chronicle client |
| `cratis/application/kotlin` | Kotlin Chronicle client |

### Framework Profiles

| Profile ID | Description |
|---|---|
| `cratis/arc` | Arc CQRS framework |
| `cratis/chronicle` | Chronicle event sourcing engine |
| `cratis/components` | React component library |
| `cratis/fundamentals` | Core primitives (`ConceptAs<T>`, `EventSourceId<T>`) |
| `cratis/specifications` | Specification framework |

### Engineering Profiles

| Profile ID | Description |
|---|---|
| `cratis/engineering` | Engineering conventions and workflows |
| `cratis/engineering/csharp` | C# engineering conventions |
| `cratis/engineering/typescript` | TypeScript engineering conventions |
| `cratis/engineering/react` | React engineering conventions |

### Language Profiles

| Profile ID | Description |
|---|---|
| `cratis/language/csharp` | C# language conventions |
| `cratis/language/typescript` | TypeScript language conventions |
| `cratis/language/elixir` | Elixir language conventions |
| `cratis/language/kotlin` | Kotlin language conventions |

### Specialized Profiles

| Profile ID | Description |
|---|---|
| `cratis/documentation` | Documentation writing |
| `cratis/review` | Code review, performance, security |
| `cratis/studio` | Studio MCP safety guidance |
| `cratis/cli` | CLI operations |
| `cratis/lens` | Lens browser extension |
| `cratis/screenplay` | Screenplay event modeling |
| `cratis/stage` | Stage rendering and sandbox |

## How to Use Profiles

### 1. Select Your Profile

Choose the profile that matches your current work:

```json
{
  "schemaVersion": "1.0.0",
  "profiles": [
    "cratis/application/csharp",
    "cratis/engineering/csharp"
  ]
}
```

### 2. Profile Composition

Profiles can compose other profiles. For example:

- `cratis/application` composes `cratis/application/csharp`, `cratis/application/react`, `cratis/application/typescript`
- `cratis/full` composes all full-stack capabilities

When you select a parent profile, all child profiles are automatically included.

### 3. Multi-Profile Work

You can work with multiple profiles simultaneously:

```json
{
  "profiles": [
    "cratis/application/csharp",      // Backend development
    "cratis/application/react",       // Frontend development
    "cratis/engineering/csharp"       // Engineering conventions
  ]
}
```

### 4. Language-Specific Profiles

Select language profiles when working with specific languages:

```json
{
  "profiles": [
    "cratis/language/csharp",
    "cratis/language/typescript"
  ]
}
```

## Profile-Specific Rules

Every rule file declares its profile in the frontmatter:

```markdown
---
profile: application
---
```

- **`profile: application`** - Rules for building applications on Cratis
- **`profile: framework`** - Rules for contributing to Cratis framework repos
- **No profile tag** - Universal rules that apply to both profiles

## Finding Profile Information

- **Full catalog:** [profile-catalog.json](../profile-catalog.json)
- **Application rules:** [general.md](./general.md) (Application profile section)
- **Framework rules:** [framework.md](./framework.md)
- **Engineering conventions:** [csharp.md](./csharp.md), [typescript.md](./typescript.md)

## See Also

- [general.md](./general.md) - Project instructions and profile overview
- [vertical-slices.md](./vertical-slices.md) - Application profile architecture
- [framework.md](./framework.md) - Framework profile architecture
- [profile-catalog.json](../profile-catalog.json) - Complete profile definitions
