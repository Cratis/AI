# Run the model's specifications in Stage

Record `cratis --version` for the delivery CLI and pin a Stage SpecRunner image with semantic support, such as Stage 6.4.1. The runner is a separate Docker job, not the sandbox CLI. Use an authorized disposable run with one application model, mounted read-only, and a fresh writable results directory:

```sh
docker run --rm -v "$PWD/model:/model:ro" -v "$PWD/results:/output" \
  cratis/stage-specrunner:6.4.1 --model /model --output /output/results.json \
  --engine semantic --application Library
```

For a focused run, add `--specification` with the specification address, `--scope` with comma-separated identity scopes, or `--catalog` with the path to a catalog available inside the container, as applicable. Report the selected scope. Exit 0 means the report was written, not that specs passed. Read the `stage-spec-run/1` report and give Passed, Failed and Unsupported counts (and any other nonpassing outcomes); Unsupported is not a pass. On runner refusal, report the diagnostic rather than using a stale report.

Report Stage semantic results on their own line, separately from rendered Debug target tests and Screenplay reference results. Structural verification does not execute behavior; a Stage semantic pass is neither Screenplay reference execution nor proof of generated code.
