---
name: cratis-specifications-observe-ui
description: Use when writing a Storybook interaction test or Playwright journey to prove UI state, focus or navigation. Not for choosing controls (cratis-components-choose-control).
compatibility: Requires Node.js and the application's UI runner; browser journeys require Playwright Chromium.
---

# Test what the actor can do

1. Fix a named state, actor and observation. Use a component interaction by default: start the story with fresh data and a recording command callback. Read references/story-states.md when a previous play leaves data or calls behind. Read references/view-model-test.md when the question concerns only coordination logic. **Done:** the initial accessible controls and callback count are known without contacting a shared service.
2. Find the input by its label and the button by role and accessible name. For a blank name, verify Add is unavailable and submission does not call the callback. Enter Aster, activate Add, then assert one call with Aster and the resulting visible row. **Done:** both the user's feedback and the effect match; counting calls alone misses a broken render.
3. Switch to a real browser when the claim is navigation, focus restoration or a live host connection. Read references/browser-journey.md for isolation and evidence. **Done:** after keyboard activation the active element, intended URL or live query result changes as specified. A mock response cannot prove command-to-query delivery.

Requires the project's Playwright installation for browser checks: run `npx --no-install playwright install --list`. If the matching Chromium is missing, run `npx playwright install chromium` or report the browser check unverified. From the application's UI project run `npx --no-install playwright test journey.spec.ts` with the path to the keyboard journey. Expect blank input to leave the list unchanged, valid input to add one row, and focus to return to the named control. If the locator matches two Add buttons, scope it to the named dialog; do not select by array index or replace the assertion with a screenshot.
