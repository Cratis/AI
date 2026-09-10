# Adopt Cratis AI in a project

There are two ways to bring Cratis AI into a repository, and they compose:

- **Marketplace plugin** — the zero-config path. Add `Cratis/AI` as a marketplace
  in Claude Code, Codex, GitHub Copilot, or Cursor and install the whole public
  bundle. See the [native marketplace installation
  section](../README.md#native-marketplace-installation) of the repository
  README.
- **Profile subscription** — this how-to. Name exactly the profiles the
  repository needs (per product, per language, per architecture) in
  `.cratis/ai.json`, pinned to exact versions, with updates arriving as reviewed
  pull requests.

Per-profile packages beyond `@cratis/pi` release as each profile
passes its preview gates; until then, the marketplace plugin delivers the
skills and the subscription records the intended scope.

## 1. Choose the repository scenario

| Repository scenario | Start with |
| --- | --- |
| Fundamentals library consumer | `cratis/fundamentals` |
| Arc backend without Chronicle | `cratis/arc` (language-scoped: `cratis/arc/csharp`, `cratis/arc/kotlin`) |
| Chronicle-only .NET application | `cratis/application/chronicle-dotnet` or `cratis/chronicle/csharp` |
| Chronicle client in Kotlin | `cratis/chronicle/kotlin` |
| Chronicle client in TypeScript or Elixir | `cratis/chronicle/typescript`, `cratis/chronicle/elixir` |
| Arc + React + Components without Chronicle | `cratis/application/react` |
| Full Arc + Chronicle + React application | `cratis/application` or `cratis/application/csharp` |
| Application in a language Arc does not support yet | `cratis/application/typescript`, `cratis/application/elixir` |
| Specification library or test project | `cratis/specifications/dotnet` or `cratis/specifications/typescript` |
| Cratis Chronicle framework repository | `cratis/engineering` |
| Private Studio repository | `cratis/engineering` plus a private local overlay |

Browse the generated
[package and capability catalog](../catalog/generated/human-catalog/CATALOG.md)
to compare package descriptions, included skills, and availability. See
[Profile reference](./profile-reference.md) for the complete planned map.

## 2. Add the exact subscription

Create `.cratis/ai.json` in the repository. Do not use `latest`, branches, or
floating ranges.

```json
{
  "schemaVersion": "1.0.0",
  "channel": "public",
  "version": "1.0.0",
  "profiles": ["cratis/application/arc-only"],
  "harnesses": ["claude", "codex", "copilot", "pi"],
  "updatePolicy": "reviewed-pull-request",
  "projectContext": ".cratis/PROJECT.md"
}
```

Use `cratis-engineering` only for Cratis-maintainer profiles. Public and
engineering profiles cannot appear in the same subscription; use separate
reviewed subscriptions or generated artifacts when both audiences are needed.

## 3. Add project context

Create `.cratis/PROJECT.md` with facts owned by this repository:

```markdown
# Project context

This is an Arc-only application. Do not assume Chronicle event sourcing.

Run the solution's Debug and Release builds, relevant specifications, frontend
lint/tests, and build before declaring work complete.
```

Keep credentials out of project context. Record only how to obtain or use them
through the approved secret mechanism.

## 4. Add a minimal bootstrap

`AGENTS.md` should locate project context and selected shared behavior rather
than copy the shared corpus:

```markdown
# Repository AI bootstrap

Read `.cratis/PROJECT.md` before planning or changing code. Follow the exact
Cratis AI profiles pinned in `.cratis/ai.json`. Repository-specific guidance
wins when it deliberately narrows shared guidance.
```

Add thin host-native adapters only where a host cannot discover these files or
package skills directly.

## 5. Install the host package

### Pi

Install the published package:

```bash
pi install -l npm:@cratis/pi
pi list
```

Commit the resulting `.pi/settings.json` after review. Pi installs missing
project packages after the repository is trusted.

To load only selected skills from a broader package, use package-root-relative
filters:

```json
{
  "packages": [
    {
      "source": "npm:@cratis/ai-chronicle@1.0.0",
      "skills": [
        "skills/cratis-chronicle-projection",
        "skills/cratis-chronicle-read-model"
      ],
      "extensions": []
    }
  ],
  "enableSkillCommands": true
}
```

### Marketplace hosts

The Claude Code, Codex, GitHub Copilot, and Cursor plugins resolve the same
skills directly from the `Cratis/AI` repository, so a developer machine can run
the marketplace plugin while this subscription documents the repository's exact
scope and receives reviewed per-profile packages as they publish. See the
[README marketplace section](../README.md#native-marketplace-installation) for
the commands.

Kiro, Junie, Gemini CLI, and Pi have no working marketplace install until their
root manifests or packages land; use the published npm packages or the
repository-local adapters for those hosts.

## 6. Verify adoption

Before merging adoption:

1. confirm package/profile/version match `.cratis/ai.json`;
2. inspect the package manifest, provenance, and checksums;
3. start the selected harness in a clean project session;
4. verify one positive skill trigger and one near-miss exclusion;
5. run repository build, specifications, lint, and test gates;
6. confirm `AGENTS.md`, `.cratis/PROJECT.md`, local skills, credentials, and
   unrelated settings are unchanged;
7. remove the package and confirm the repository remains usable.

## 7. Update and roll back

Updates arrive as normal pull requests. Review changes to:

- `.cratis/ai.json`;
- host-native package settings or lock files;
- generated checksums/provenance references;
- no shared skill or rule bodies.

For Pi, update to the latest published release:

```bash
pi install -l npm:@cratis/pi
```

Rollback restores the previous exact version in `.cratis/ai.json` and
`.pi/settings.json`, reruns installation, and executes the same repository gates.

## 8. Improve shared behavior

Do not edit published package bytes. If an improvement is public-safe and useful
across repositories, use the **Propose a shared Cratis AI improvement** issue in
`Cratis/AI` with the originating repository, immutable revision, product
authority, affected profiles, and compatibility impact.

Keep confidential or repository-specific behavior local. See
[Private repository overlays](./private-repository-overlays.md).
