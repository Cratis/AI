# Run the model's specifications in Stage

Record `cratis --version` for the delivery CLI. With Docker and permission for a disposable run, pin the Stage SpecRunner release you intend to verify (6.12.0 here). This is a separate job, not the sandbox CLI. Mount one application's model read-only and a new writable results directory; replace the example paths and application name:

```sh
docker run --rm -v /absolute/path/to/model:/model:ro -v /absolute/path/to/new-results:/output \
  cratis/stage-specrunner:6.12.0 --engine semantic --application Library \
  --model /model --output /output/results.json
```

For a focused run, add `--specification` with the specification's semantic identity, `--scope` with comma-separated semantic identities, or `--catalog` with the path to a catalog available inside the container, as applicable. Report the selected scope.

Exit `0` means the report was written, not that specs passed. Require `schemaVersion: stage-spec-run/1` rather than reading the report with the legacy structural-results parser. Match `semanticRevision` and `results[].specificationId` to the intended revision and selection. Count `results[].outcome` and report Passed, Failed, Unsupported and Cancelled separately, including zeros. Include expectation details for failures and the capability and reason for unsupported checks. A missing report, unknown outcome, missing selected specification or nonpassing outcome cannot establish a green run. If the runner refuses, report the diagnostic rather than reading a stale report.

Report Stage semantic results separately from Screenplay reference execution (`cratis-screenplay-accept-model`) and [rendered application tests](../../cratis-stage-render-slice/SKILL.md). Structural verification does not execute behavior; a Stage semantic pass does not prove generated code.
