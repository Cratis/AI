# Diagnose slow .NET specs

From the repository root, enable phase timing for the built spec executable (substitute its actual path and supported test filter):

```sh
report_dir=$(mktemp -d)
CRATIS_SPECS_TIMINGS=1 CRATIS_SPECS_TIMINGS_FILE="$report_dir/phases.json" \
  ./bin/Release/net10.0/MyProject.Specs
```

Read `Establish`, `Because` and `Destroy` durations in the JSON. Require the report to exist: failure to write it does not fail the run. Compare executable wall time separately: startup, discovery and reporting are not phase timings. The slow-phase diagnostic threshold defaults to 1,000 ms; `CratisSpecificationsSlowPhaseThreshold` sets it in milliseconds in the project, not as a performance budget.

Save the before report and compare the same run after the change: same inputs, runtime, filter and concurrency, excluding restore and build from execution time. Require the same discovery and skip inventory. Enabling timing adds diagnostics, not changes to test selection, concurrency or outcomes.
