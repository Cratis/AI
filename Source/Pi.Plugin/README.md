# Cratis AI integration for Pi

This is the **plugin path** for repositories that do not use `cratis ai`.
Install it into a Pi project:

```bash
pi install -l npm:@cratis/pi
```

The package reads the repository's `.cratis/ai.json`, resolves its profiles and
languages through the packaged profile catalog, and contributes only the matching
skills. It also loads packaged rules, prompts, agents, the subagent tool, and
Cratis quality hooks. When no `.cratis/ai.json` exists, it exposes the complete
packaged skill set. It therefore gives Pi the complete single-harness Cratis
experience without requiring the Cratis CLI.

The managed CLI path remains the choice when one repository must configure and
synchronize several harnesses. It writes the resolved corpus to `.cratis/ai`,
creates every harness integration, and records hashes for safe update and
uninstall. That managed setup loads rules through its own `.pi/extensions/cratis-rules`
extension and does not require this package. If both paths are present, the package
yields to the managed installation to avoid duplicate resources and hooks. The Pi
package manages only Pi; it neither configures other harnesses nor owns a local
managed corpus.
