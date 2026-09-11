# Cratis AI integration for Pi

This is the **plugin path** for repositories that do not use `cratis ai`.
Install it into a Pi project:

```bash
pi install -l npm:@cratis/pi
```

The extension reads the repository's `.cratis/ai.json`, resolves its profiles
through the packaged profile catalog, contributes only the matching skills, and
adds the packaged Cratis rules and prompts to Pi. It therefore gives Pi the same
configuration-aware Cratis content without requiring the Cratis CLI.

The managed CLI path remains the choice when one repository must configure and
synchronize several harnesses. It writes the resolved corpus to `.cratis/ai`,
creates every harness integration, and records hashes for safe update and
uninstall. The Pi plugin manages only Pi; it neither configures other harnesses
nor owns a local managed corpus.
