# Verify declared specifications against Stage

With Docker available and permission to run Stage locally, mount the `.play` model read-only and a new writable host results directory. Replace both host paths; use the tag for the Stage release that the result must describe (shown here for 6.12.0).

```sh
docker run --rm \
    -v /absolute/path/to/model:/model:ro \
    -v /absolute/path/to/new-results:/output \
    cratis/stage-specrunner:6.12.0 --engine semantic \
    --model /model --output /output/results.json
```

Open the new `results.json`. Require `schemaVersion` to be `stage-spec-run/1`; do not read it with the legacy structural-results parser. Match `semanticRevision` and `results[].specificationId` to the intended revision and selection. Count `results[].outcome` and report **Passed**, **Failed**, **Unsupported** and **Cancelled** separately, including zeros. For failures report the expectation details; for unsupported checks report the capability and reason. A missing report, unknown outcome, missing selected specification or non-passing outcome cannot establish a green run.

Exit `0` only confirms that a report was written, even if specifications failed or were blocked. Use a new output directory so a failed invocation cannot leave you reading an earlier report.

This verifies Stage's semantic engine. Keep it distinct from the Screenplay reference evaluator used by `cratis-screenplay-accept-model` and from [building and testing rendered output](../../cratis-stage-render-slice/SKILL.md).
