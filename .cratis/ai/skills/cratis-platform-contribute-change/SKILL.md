---
name: cratis-platform-contribute-change
description: Use when a contributor is changing a Cratis platform library or tool and needs to locate its published contract, implementation and focused check. For a completed change awaiting release notes, use cratis-platform-prepare-release-pr.
---

# Change the contract where the platform owns it

Start inside the product repository. Read its contributor instructions, supported targets and release workflow. Locate the package or executable the caller actually uses. Follow a nearby public member or CLI operation inward to its implementation and outward to its documented example and caller-facing spec. Keep the repository's structure; do not scaffold an application slice in a framework.

1. Describe the promise before editing. For example: “A caller can distinguish an invalid command from one denied by authorization.” Record the input, existing result and expected result. Identify consumers of the return type, wire representation or persisted data before changing it. A source-compatible change can still break a wire reader.
2. Change the owning implementation. Follow the surrounding package's naming, target frameworks, dependency pins and generated-file boundaries. If the surface is generated, edit its source, then use that repository's generation command.
3. Choose the cheapest check that crosses the changed boundary. For the example, execute the command under the relevant policy and assert the **reason** for refusal, not just failure. Extend an existing case where possible. For an internal refactor, run the nearby unchanged behavior spec; don't add a spec for each moved method.
4. Use the repository's own build/test entry point for the affected target. If the check passes only against the implementation project while consumers use a generated or packaged surface, verify a representative consumer at that boundary. For example, when changing Arc's Chronicle-backed command scenario, its own `Chronicle.Specs` project exercises that contract; running a sample application's entire UI suite would test a different boundary. Record what ran and any target not exercised.
5. Update the caller's guide or reference next to its existing peers when usage changes. Show the changed input and observable result. Follow the product's navigation convention for a new page. If the old result or syntax stops working, identify the migration and flag the breaking change instead of hiding it behind a patch label.

Hand the caller impact, compatibility decision and verification result to [prepare the release PR](../cratis-platform-prepare-release-pr/SKILL.md).
