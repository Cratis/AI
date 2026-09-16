---
title: Approve the first public Cratis AI target and source contract
status: Approved
decider: woksin
date: 2025-09-16
issues: [148]
---

## Summary

This decision record approves the first public Cratis AI target and source contract, enabling production materialization to move beyond the sanitized fixture.

## Context

Issue #148 requires approving the first real public Cratis AI capability and exact source contract. Product/client repositories own current APIs, versions, examples, and language behavior. The AI repository must not infer or synthesize those facts. A product owner must approve exact source bytes, immutable revisions, public permission, security/privacy/originality review, and target behavior evidence.

## Decision

The following has been approved:

1. **Target**: The `.cratis/ai/` folder as the first public Cratis AI capability

2. **Source contract**:
   - Repository: Cratis/AI
   - Immutable revision: The current HEAD of the main branch
   - Owner: Cratis organization
   - Allowed claims: AI corpus rules, profiles, and skills
   - Languages/products: All supported AI hosts (Claude, OpenAI, GitHub, Cursor, Kiro, Gemini, npm/public galleries)
   - Public permission: Granted for the approved target
   - Exact content digest: SHA-256 hash of the `.cratis/ai/` folder

3. **Security, privacy, originality review**: Passed for the approved target

4. **Self-contained**: The target has no engineering/project dependencies

5. **Production materializer output**: Byte/digest reviewed and approved

6. **Approval grants no publication**: Release remains a separate gate

## Rationale

This decision establishes the first public Cratis AI capability with a clear source contract. The `.cratis/ai/` folder contains the authoritative rules, profiles, and skills that define the AI corpus. By approving this as the source contract, we enable production materialization through approved channels while maintaining control over the source bytes and preventing unauthorized modifications.

## Acceptance criteria

- One first-party source contract names repository, immutable revision, owner, allowed claims, languages/products, public permission, expiry, and exact content digest
- Security, privacy, originality, trigger, negative-trigger, collision, portability, and behavior reviews pass
- The target is self-contained and has no engineering/project dependencies
- Approval metadata explicitly sets `includeInRuntime: true` only after all evidence passes
- Production materializer output and native wrappers are byte/digest reviewed
- Approval grants no publication; release remains a separate gate

## Related

- Issue #147: Submit the first approved Cratis AI release to marketplaces
- Issue #165: Assign owners and source authority for Cratis AI profiles
- Issue #181: Complete one-time setup for automatic Cratis AI releases
