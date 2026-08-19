#!/bin/zsh
set -euo pipefail

script_directory=${0:A:h}
repository_root=${script_directory:h:h:h}
publish_directory="$script_directory/NativeAot/bin/Release/net10.0/osx-arm64/publish"
dotnet publish "$script_directory/NativeAot/Cratis.Factory.DefinitionWorkflowNativeAot.csproj" -c Release -r osx-arm64 --self-contained true

run_directory=$(mktemp -d /private/tmp/definition-workflow-aot.XXXXXX)
trap 'rm -rf "$run_directory"' EXIT
cp "$publish_directory/Cratis.Factory.DefinitionWorkflowNativeAot" "$run_directory/consumer"
chmod 500 "$run_directory/consumer"
profile="$run_directory/sandbox.sb"
printf '%s\n' \
    '(version 1)' \
    '(deny default)' \
    '(allow process*)' \
    '(allow sysctl-read)' \
    '(allow mach-lookup)' \
    '(allow file-read*)' \
    '(deny file-read* (subpath "'$repository_root'"))' \
    '(deny network*)' \
    '(deny file-write*)' > "$profile"

consumer_output="$run_directory/consumer.out"
consumer_error="$run_directory/consumer.err"
time_output="$run_directory/consumer.time"

set +e
/usr/bin/time -l -o "$time_output" /usr/bin/sandbox-exec -f "$profile" "$run_directory/consumer" "$run_directory" > "$consumer_output" 2> "$consumer_error"
command_exit_code=$?
set -e

sed -n '1,80p' "$consumer_output"
sed -n '1,80p' "$consumer_error" >&2
if (( command_exit_code != 0 )); then
    echo "BLOCKED nativeAotSandboxExit=$command_exit_code"
    exit 1
fi

peak_rss=$(awk '/maximum resident set size/ { print $1 }' "$time_output")
if [[ -z "$peak_rss" || "$peak_rss" != <-> || "$peak_rss" -eq 0 ]]; then
    echo "BLOCKED coldPeakRss=unavailable coldRssCeiling=134217728"
    exit 1
fi
if (( peak_rss > 128 * 1024 * 1024 )); then
    echo "BLOCKED coldPeakRss=$peak_rss coldRssCeiling=134217728"
    exit 1
fi

wall_seconds=$(awk '/ real / { print $1 }' "$time_output")
if [[ -z "$wall_seconds" ]] || ! awk -v value="$wall_seconds" 'BEGIN { exit !(value <= 2.0) }'; then
    echo "BLOCKED nativeAotWallSeconds=${wall_seconds:-unavailable} nativeAotWallCeilingSeconds=2"
    exit 1
fi

echo "PASSED coldPeakRss=$peak_rss coldRssCeiling=134217728 nativeAotWallSeconds=$wall_seconds nativeAotWallCeilingSeconds=2 sandbox=true"
