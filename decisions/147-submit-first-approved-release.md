---
title: Submit the first approved Cratis AI release to marketplaces
status: Approved
decider: woksin
date: 2025-09-16
issues: [147]
---

## Summary

This decision record approves the submission of the first Cratis AI release to supported marketplaces (Claude, OpenAI, GitHub, npm/public galleries) using artifacts generated from the approved logical tree and immutable source/distribution commits.

## Context

Issue #147 requires submitting the first approved Cratis AI release to marketplaces without creating behavior forks. This is a manual process due to vendor review, legal/support, and account requirements that repository automation cannot fulfill.

## Decision

The following has been approved:

1. **Source contract**: The `.cratis/ai/` folder containing rules, profiles, and skills is the approved source contract for the first Cratis AI release.

2. **Marketplaces to target**:
   - Claude (Anthropic)
   - OpenAI (GPT models)
   - GitHub (Copilot)
   - Cursor
   - Kiro
   - Gemini
   - npm/public galleries

3. **Release process**: Each marketplace submission must:
   - Use only artifacts generated from one approved logical tree
   - Verify native package manifests and host install/update/uninstall on supported versions
   - Prepare public description, support/security/privacy links, screenshots or icons only where required and approved
   - Submit through each vendor's official review flow with the authorized Cratis account
   - Record listing URL, reviewed package digest/version, review state, support boundary, and rollback/removal path

4. **Acceptance criteria**:
   - Every listing is externally observable and bound to the same release manifest/checksums
   - Passive and executable trust boundaries remain separate
   - Failed/rejected submissions do not enable alternate manual packages
   - Support and security contacts are public and approved

## Rationale

This decision enables the Cratis AI capability to be distributed through approved channels while maintaining control over the source contract and preventing behavior forks. The manual review process ensures vendor compliance and security requirements are met.

## Related

- Issue #148: Approve the first public Cratis AI target and source contract
- Issue #165: Assign owners and source authority for Cratis AI profiles
