// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;

namespace Cratis.AI.Workers;

/// <summary>
/// The contract for how a worker's prompt reaches its container - as a file, never as an
/// environment variable or a command-line argument. Ported from Direct's
/// <c>Work.Workers.WorkerPromptFile</c> (plan Section 5.6).
/// </summary>
/// <remarks>
/// Linux caps a single environment variable or argument at <c>MAX_ARG_STRLEN</c>, which is 32 pages
/// - 128 KiB - and the kernel refuses the whole <c>execve</c> with <c>E2BIG</c> when anything
/// exceeds it. Not gracefully: the container never starts, and the only trace is one line from the
/// runtime before the entrypoint has run at all -
/// <c>exec /usr/local/bin/entrypoint.sh: argument list too long</c>.
/// <para>
/// A prompt is built from the issues it covers, so its size is a function of how much work somebody
/// batched together. On 2026-09-02 a consolidation over seventeen issues produced 173,380 bytes and
/// was dead on arrival - the work sat Running against a container that could not be started. Nothing
/// in the system could report why, because nothing in the system had run.
/// </para>
/// <para>
/// A file has no such limit, which is why credentials already travel this way (see
/// <see cref="WorkerSecrets"/>) - and it happens to be the better answer for the prompt too, since
/// the container specification is readable by anyone who can read it and a prompt carries the bodies
/// of whatever issues it covers.
/// </para>
/// </remarks>
public static class WorkerPromptFile
{
    /// <summary>
    /// The name of the file carrying the prompt, delivered alongside the secrets.
    /// </summary>
    public const string FileName = "prompt.md";

    /// <summary>
    /// The full path of the prompt file inside the container.
    /// </summary>
    public const string Path = $"{WorkerSecrets.Directory}/{FileName}";

    /// <summary>
    /// The environment variable naming the prompt file for the entrypoint. It carries a path, not a
    /// prompt, so it is small by construction and safe on the container specification. Kept as
    /// <c>DIRECT_PROMPT_FILE</c> - the literal name <c>entrypoint.sh</c> reads today; see decision
    /// 0010 for why the harness's env-var contract was deliberately not renamed in the same move as
    /// the images themselves.
    /// </summary>
    public const string PathVariableName = "DIRECT_PROMPT_FILE";

    /// <summary>
    /// The environment variable the prompt used to travel in, and still does for a runtime that has
    /// not been taught the file - named here so the runtimes can take it back off the specification
    /// rather than repeating the string.
    /// </summary>
    public const string LegacyVariableName = "DIRECT_PROMPT";

    /// <summary>
    /// The largest prompt that is delivered whole.
    /// </summary>
    /// <remarks>
    /// A Kubernetes <c>Secret</c> holds at most 1 MiB across all of its keys, and the prompt shares
    /// one with the credentials. This leaves a wide margin under that - four times the environment
    /// limit that made the file necessary in the first place, and three times the largest prompt
    /// seen in production.
    /// </remarks>
    public const int MaxBytes = 512 * 1024;

    /// <summary>
    /// The prompt as it is written to the file, cut to <see cref="MaxBytes"/> when it is longer.
    /// </summary>
    /// <param name="prompt">The prompt as built.</param>
    /// <returns>The prompt to deliver.</returns>
    /// <remarks>
    /// Cut rather than refused. A prompt this size means somebody batched a great deal of work
    /// together, and the useful thing to do with that is run it against as much of the instruction
    /// as fits - saying so, so the agent knows its input is incomplete and does not read the
    /// truncation as the end of the request. Refusing the dispatch instead would leave the work
    /// queued behind an impediment it could never clear, which is the failure this whole area has
    /// spent a night removing.
    /// <para>
    /// The cut is made on a character boundary and the marker is appended after it, so the result is
    /// always valid UTF-8 and always ends with an explanation rather than half a sentence.
    /// </para>
    /// </remarks>
    public static string Clamp(string prompt)
    {
        if (string.IsNullOrEmpty(prompt) || Encoding.UTF8.GetByteCount(prompt) <= MaxBytes)
        {
            return prompt;
        }

        var marker = $"{Environment.NewLine}{Environment.NewLine}" +
            $"> The instructions above were cut at {MaxBytes} bytes because they did not fit. " +
            "Whatever came after this point is missing - work from what is here, and say in your " +
            "summary that the instructions were truncated.";

        var room = MaxBytes - Encoding.UTF8.GetByteCount(marker);
        var kept = prompt.Length;
        while (kept > 0 && Encoding.UTF8.GetByteCount(prompt[..kept]) > room)
        {
            kept -= Math.Max(1, (Encoding.UTF8.GetByteCount(prompt[..kept]) - room) / 4);
        }

        return prompt[..kept] + marker;
    }
}
