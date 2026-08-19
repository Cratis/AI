#!/bin/zsh
set -euo pipefail

script_directory=${0:A:h}
project="$script_directory/Cratis.Factory.DefinitionWorkflowCompilationParity.csproj"
assembly="$script_directory/bin/Release/net10.0/Cratis.Factory.DefinitionWorkflowCompilationParity.dll"

dotnet build "$project" -c Release
"$script_directory/run-native-aot-sandbox.sh"

run_directory=$(mktemp -d /private/tmp/definition-workflow-performance.XXXXXX)
trap 'rm -rf "$run_directory"' EXIT
suite_output="$run_directory/suite.out"
suite_error="$run_directory/suite.err"
time_output="$run_directory/suite.time"

set +e
/usr/bin/time -l -o "$time_output" dotnet "$assembly" --performance > "$suite_output" 2> "$suite_error"
command_exit_code=$?
set -e

sed -n '1,240p' "$suite_output"
sed -n '1,120p' "$suite_error" >&2
if (( command_exit_code != 0 )); then
    echo "BLOCKED performance-suite-exit=$command_exit_code"
    exit 1
fi

peak_rss=$(awk '/maximum resident set size/ { print $1 }' "$time_output")
if [[ -z "$peak_rss" || "$peak_rss" != <-> || "$peak_rss" -eq 0 ]]; then
    echo "BLOCKED structuralMaximumPeakRss=unavailable structuralMaximumRssCeiling=536870912"
    exit 1
fi
if (( peak_rss > 512 * 1024 * 1024 )); then
    echo "BLOCKED structuralMaximumPeakRss=$peak_rss structuralMaximumRssCeiling=536870912"
    exit 1
fi

echo "PASSED structuralMaximumPeakRss=$peak_rss structuralMaximumRssCeiling=536870912 scope=all-exact-structural-maximum-calls"
