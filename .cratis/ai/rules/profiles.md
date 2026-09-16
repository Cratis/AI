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

| Profile ID | Description | Automatically Includes |
|---|---|---|
| `cratis/application` | Full application stack (C# + React + TypeScript) | `cratis/application/csharp`, `cratis/application/elixir`, `cratis/application/kotlin`, `cratis/application/typescript`, `cratis/arc/core`, `cratis/arc/react`, `cratis/chronicle/core`, `cratis/components`, `cratis/fundamentals`, `cratis/specifications/dotnet`, `cratis/specifications/typescript` |
| `cratis/application/csharp` | C# backend with Arc + Chronicle | `cratis/arc`, `cratis/arc/react`, `cratis/chronicle`, `cratis/components`, `cratis/fundamentals`, `cratis/language/csharp`, `cratis/specifications/dotnet`, `cratis/specifications/typescript` |
| `cratis/application/react` | React frontend with Cratis Components | `cratis/arc/core`, `cratis/arc/react`, `cratis/components`, `cratis/fundamentals`, `cratis/specifications/dotnet`, `cratis/specifications/typescript` |
| `cratis/application/typescript` | TypeScript client for Chronicle | `cratis/chronicle/client-typescript`, `cratis/language/typescript`, `cratis/specifications/typescript` |
| `cratis/application/arc-chronicle` | Arc + Chronicle integration | `cratis/arc/core`, `cratis/chronicle/core`, `cratis/fundamentals`, `cratis/specifications/dotnet` |
| `cratis/application/arc-only` | Arc without Chronicle | `cratis/arc/core`, `cratis/fundamentals`, `cratis/specifications/dotnet` |
| `cratis/application/chronicle-dotnet` | Chronicle .NET client | `cratis/chronicle/client-dotnet`, `cratis/chronicle/core`, `cratis/fundamentals`, `cratis/specifications/dotnet` |
| `cratis/application/elixir` | Elixir Chronicle client | `cratis/chronicle/client-elixir`, `cratis/language/elixir` |
| `cratis/application/kotlin` | Kotlin Chronicle client | `cratis/arc/client-kotlin`, `cratis/chronicle/client-kotlin`, `cratis/language/kotlin` |

### Framework Profiles

| Profile ID | Description | Automatically Includes |
|---|---|---|
| `cratis/arc` | Arc CQRS framework | `cratis/arc/csharp`, `cratis/arc/kotlin` |
| `cratis/chronicle` | Chronicle event sourcing engine | `cratis/chronicle/compliance`, `cratis/chronicle/csharp`, `cratis/chronicle/elixir`, `cratis/chronicle/kotlin`, `cratis/chronicle/multi-tenancy`, `cratis/chronicle/typescript`, `cratis/chronicle/web-workbench` |
| `cratis/components` | React component library | (no child profiles) |
| `cratis/fundamentals` | Core primitives (`ConceptAs<T>`, `EventSourceId<T>`) | (no child profiles) |
| `cratis/specifications` | Specification framework | (no child profiles) |

### Engineering Profiles

| Profile ID | Description | Automatically Includes |
|---|---|---|
| `cratis/engineering` | Engineering conventions and workflows | `cratis/engineering/core`, `cratis/engineering/csharp`, `cratis/engineering/elixir`, `cratis/engineering/kotlin`, `cratis/engineering/react`, `cratis/engineering/typescript` |
| `cratis/engineering/csharp` | C# engineering conventions | `cratis/engineering/core` |
| `cratis/engineering/typescript` | TypeScript engineering conventions | `cratis/engineering/core` |
| `cratis/engineering/react` | React engineering conventions | `cratis/engineering/core` |

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

Profiles can compose other profiles. When you select a parent profile, all child profiles are automatically included.

**How composition works:**
- Selecting `cratis/application` automatically includes all its child profiles (listed in the "Automatically Includes" column above)
- Selecting `cratis/full` includes all full-stack capabilities across C#, TypeScript, Elixir, and Kotlin
- Selecting `cratis/engineering` automatically includes all engineering convention profiles

**Examples:**

```json
{
  "schemaVersion": "1.0.0",
  "profiles": [
    "cratis/application"  // Automatically includes all child profiles
  ]
}
```

```json
{
  "schemaVersion": "1.0.0",
  "profiles": [
    "cratis/application/csharp"  // Includes: arc, arc/react, chronicle, components, fundamentals, language/csharp, specifications/dotnet, specifications/typescript
  ]
}
```

```json
{
  "schemaVersion": "1.0.0",
  "profiles": [
    "cratis/full"  // Includes all full-stack capabilities
  ]
}
```

**Note:** The profile-catalog.json file defines the complete composition tree. When you select a parent profile, the system automatically resolves and includes all child profiles listed in the `composes` array.

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

### 5. Agent Harnesses Exclusion

**Important:** The Agent Harnesses (`.agents/` folder) should **not** include the `skills` folder from the AI corpus. The skills folder is managed separately and should be excluded from agent plugin installations.

When configuring agent plugins:
- The `skills` field in `marketplace.json` should point to an empty array or be omitted
- The `skills` symlink in `.agents/plugins/` should not reference `../.cratis/ai/skills`
- Agent Harnesses should only include the rules and profile-catalog.json for profile resolution

This ensures that:
1. Skills are managed independently from agent plugins
2. The AI corpus remains the source of truth for rules and profiles
3. Agent Harnesses don't duplicate or override the skills folder

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
