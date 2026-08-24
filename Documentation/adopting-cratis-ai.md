# Adopt Cratis AI in a project

Use this how-to after the selected profile has a published version. Cratis AI
packages are currently approval-pending; package commands shown here describe
the released workflow and will fail until publication.

## 1. Choose the repository scenario

| Repository scenario | Start with |
| --- | --- |
| Fundamentals library consumer | `public-fundamentals` |
| Arc backend without Chronicle | `public-application-arc-only` |
| Chronicle-only .NET application | `public-application-chronicle-dotnet` |
| Arc + React + Components without Chronicle | `public-application-react` |
| Full Arc + Chronicle + React application | `public-application` |
| Chronicle Kotlin client | `public-chronicle-client-kotlin` |
| Specification library or test project | `public-specifications-dotnet` or `public-specifications-typescript` |
| Cratis Chronicle framework repository | `engineering-chronicle` |
| Private Studio repository | `engineering-studio` plus a private local overlay |

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
  "profiles": ["public-application-arc-only"],
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

Install an exact project package:

```bash
pi install -l npm:@cratis/ai-application-arc@1.0.0
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

### Other harnesses

Use the root-native artifact generated for the exact profile and version. For
Copilot, Cursor, Kiro, VS Code, and other compatible hosts, prefer the portable
Agent Plugins 1.0 artifact; host marketplace wrappers point at the same plugin
identity and skill layout. Do not point a host at the mixed `Cratis/AI` source
repository or the multi-profile distribution root.

The release page supplies exact Agent Plugin, Claude, Codex, Copilot, Cursor,
Gemini, Grok, Deep Code, preview DeepSeek Harness, Kiro, Junie, and Agent Skills
commands after each host is actually tested.

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

For Pi, move to another exact version:

```bash
pi install -l npm:@cratis/ai-application-arc@1.1.0
```

Rollback restores the previous exact version in `.cratis/ai.json` and
`.pi/settings.json`, reruns installation, and executes the same repository gates.

## 8. Improve shared behavior

Do not edit generated package bytes. If an improvement is public-safe and useful
across repositories, use the **Propose a shared Cratis AI improvement** issue in
`Cratis/AI` with the originating repository, immutable revision, product
authority, affected profiles, and compatibility impact.

Keep confidential or repository-specific behavior local. See
[Private repository overlays](./private-repository-overlays.md).
