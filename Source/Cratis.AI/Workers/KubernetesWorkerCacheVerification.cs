// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using k8s.Models;

namespace Cratis.AI.Workers;

/// <summary>
/// Verifies selected PVC directories before the worker's scoped mounts are used.
/// </summary>
internal static class KubernetesWorkerCacheVerification
{
    /// <summary>The read-only PVC mount used only by the verifier.</summary>
    internal const string Root = "/worker-cache-verification";

    /// <summary>The fail-closed directory verification program.</summary>
    /// <remarks>The PVC root is trusted. Provisioners must protect ancestors from untrusted writers
    /// throughout pod startup. Every selected descendant must be an ordinary directory.</remarks>
    internal static readonly string Script = string.Join(
        '\n',
        """reject() { printf '%s\n' 'Invalid worker cache directory.' >&2; exit 1; }""",
        """[ "$#" -gt 1 ] || reject""",
        """[ -d "$1" ] || reject""",
        """root=$(realpath "$1") || reject""",
        "shift",
        "count=0",
        """for relative in "$@"; do""",
        """    [ -n "$relative" ] || reject""",
        "    current=$root",
        "    remaining=$relative",
        "    while :; do",
        "        component=${remaining%%/*}",
        """        case "$component" in ''|.|..) reject ;; esac""",
        "        current=$current/$component",
        """        [ ! -L "$current" ] && [ -d "$current" ] || reject""",
        """        resolved=$(realpath "$current") || reject""",
        """        [ "$resolved" = "$current" ] || reject""",
        """        case "$remaining" in""",
        "            */*) remaining=${remaining#*/} ;;",
        "            *) break ;;",
        "        esac",
        "    done",
        "    count=$((count + 1))",
        "done",
        "printf 'Verified %s cache paths\\n' \"$count\"");

    /// <summary>Builds the non-root, read-only cache verification init container.</summary>
    /// <param name="image">The worker image.</param>
    /// <param name="claim">The cache volume name.</param>
    /// <param name="plan">The validated selected directories.</param>
    /// <returns>The verification container, without worker secrets or environment.</returns>
    internal static V1Container Build(string image, string claim, WorkerCacheMounts plan) => new()
    {
        Name = "verify-worker-cache",
        Image = image,
        Command = ["/bin/sh"],
        Args = ["-eu", "-c", Script, "verify-worker-cache", Root, plan.MemoryDirectory, .. plan.MirrorPaths],
        Env = [new() { Name = "PATH", Value = "/usr/bin:/bin" }, new() { Name = "LC_ALL", Value = "C" }],
        VolumeMounts = [new() { Name = claim, MountPath = Root, ReadOnlyProperty = true }],
        SecurityContext = new()
        {
            RunAsNonRoot = true,
            RunAsUser = 1655,
            RunAsGroup = 1655,
            AllowPrivilegeEscalation = false,
            ReadOnlyRootFilesystem = true,
            Capabilities = new() { Drop = ["ALL"] }
        }
    };
}
