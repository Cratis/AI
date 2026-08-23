# Private Studio repository context

This repository owns private Studio implementation behavior. Shared Cratis AI
packages provide only public-safe engineering conventions.

## Local boundaries

- Treat deployment topology, infrastructure identifiers, unreleased APIs,
  incidents, customers, and roadmap information as confidential.
- Use repository-local source and documentation as authority.
- Use the approved organization secret mechanism for credentials; never write
  secret values in this file.
- Run this repository's own build, specification, security, and release gates.
