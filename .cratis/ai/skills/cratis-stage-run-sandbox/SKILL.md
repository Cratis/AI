---
name: cratis-stage-run-sandbox
description: Use when a model owner wants to try a Screenplay interaction in a disposable Stage runtime or run its specifications in the Stage semantic engine. For generating application files instead, use cratis-stage-render-slice.
---

# Try one interaction in a local sandbox

Start with the model folder, a running Docker engine with `docker` on the path, and permission to start a local container and exercise the chosen interaction. Model acceptance grants none of those permissions. Agree on the expected result before starting: for example, registering a fictitious author should make that author's name appear in the list.

1. Use a folder containing only the intended application. Check the configured identities, services and extensions before running it: a read-only model mount protects the source files, not an external service called by the model. If an effect could reach a shared system, stop until a disposable target is configured. Use synthetic data.
2. Start the sandbox in the foreground. For example, if the folder is named `model`, run:

   ```sh
   cratis run ./model
   ```

   For a standalone preview, keep the default loopback binding. Wait for `Ready` and check the reported model and engine. A running container is not a ready model. A typed refusal from a modeled command is different from an unsupported endpoint returning HTTP 501. Neither is evidence of a successful interaction. If inspecting a running semantic host directly, use `GET /stage/status` for readiness and `GET /stage/semantic/admission` for reported issues. On refusal, record the unsupported construct and diagnostic; do not switch engines or remove a requirement to make the preview start.
3. Use the printed Stage API reference to find the modeled command and query. If the CLI reports an application address as well, you can exercise the gesture there. Perform the agreed action once. Query or reopen the view and check the exact author, not just the row count. If the result is missing, use the printed Chronicle Workbench address to distinguish a missing fact from a missing view update. Do not repeat the command to diagnose the first attempt.
4. Record the model, input and observed outcome before pressing Ctrl+C in the run terminal. Confirm the session has ended and its container is no longer running. Report what worked **in the sandbox**: this walk neither executes the model's specification suite nor verifies a generated application. It does not authorize [rendering application files](../cratis-stage-render-slice/SKILL.md) or deployment.

To run the model's specifications instead of walking an interaction, use the [Stage specification runner](references/semantic-spec-runner.md).
