# Private repository AI overlay example

This example layers repository-owned private guidance on top of public-safe
Cratis engineering packages.

```text
AGENTS.md
.cratis/
├── PROJECT.md
└── ai.json
.agents/
└── skills/
    └── studio-local-release/
        └── SKILL.md
.pi/
└── settings.json
```

The shared package never writes these files. Replace every illustrative value
with facts owned by the private repository. Do not place credentials in prompts
or skill files; use the repository's approved secret mechanism.
