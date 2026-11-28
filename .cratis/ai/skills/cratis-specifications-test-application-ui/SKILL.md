---
name: cratis-specifications-test-application-ui
description: Use when a frontend author needs to prove a draft survives refusal, a successful action navigates, or a control responds to input. Not for a reusable component story (use cratis-specifications-observe-ui).
compatibility: Requires the application’s TypeScript test project and its installed runner.
---

# Test the consequence the user can observe

Choose the harness by the observation, not by whether the file contains JSX. For a submit decision, start without React: construct the application view model with a fake command executor and a recorder for close or navigation. Do not fake a database: this test cannot establish whether anything persisted.

1. Arrange a named draft and a pending command result. Invoke the submit action once. Check that a second click cannot start another submission while the first is pending.
2. Resolve with the outcome under test. On success, assert the destination or close request, not the number of internal setter calls. On refusal, assert that the form stays open with the original draft and the user can correct it. For Arc-backed submits, distinguish the [resolved result branches](references/typescript-command-results.md) that change the UI from a rejected promise; on a thrown error, check that the busy state clears so the user can retry.
3. Run the application's Vitest project using its existing package script. Follow an adjacent `for_*/when_*` suite for discovery, assertion setup and cleanup. A passing refusal spec must turn red if the view model closes unconditionally.

Use static rendering only for a markup contract, such as whether the initial button is disabled. Mount the control under its real providers for focus return, portals, gestures or navigation. Drive the same input as a user and observe the result by role and accessible name. Stub only the external boundary the test needs; restore timers and measurements and unmount between independent scenarios. When using Arc suspense queries, [reset their shared state](references/typescript-command-results.md#isolate-suspense-query-scenarios) as well. An interaction that passes only after a different test ran is not isolated.

A Storybook play function is useful for a rendered component interaction; running an application behavior spec does not execute that story. Conversely, a story with a fake command cannot prove command-to-row delivery.
