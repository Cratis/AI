# Execute through the command pipeline

Obtain `AsyncCommandPipeline` from the host. Construct `CommandExecutionOptions` with the operation's correlation UUID, verified principal and service resolver. Compose the stage returned by `pipeline.execute(command, options)`; do not return success before completion. Branch on `result.isSuccess()` and inspect `result.getValidationResults()` on refusal. Keep an exceptionally completed stage distinct from a completed rejected result. Test a denied command and assert the handler made no write.

For Chronicle uniqueness rejection inspect the validation finding, not an exception. In Java scenarios `ChronicleCommandScenarios.shouldHaveConstraintViolation(result, "unique-name").getReasonDetail()` identifies the failed constraint. On a concurrency finding reload the decision state before retrying.
