// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Runtime.CompilerServices;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Common;

/// <summary>
/// Extension methods for <see cref="ICommandPipeline"/> for the common case of issuing a command
/// without inspecting the <see cref="CommandResult"/> it produces. Ported from Direct's
/// <c>Common.CommandPipelineExtensions</c> (plan Section 5.2 step 1).
/// </summary>
public static class CommandPipelineExtensions
{
    /// <summary>
    /// Executes a command and logs a warning naming the command, the caller and the reason when it
    /// was not successful, so a fire-and-forget command whose result nobody inspects is never
    /// silently dropped.
    /// </summary>
    /// <param name="commandPipeline">The <see cref="ICommandPipeline"/> to execute the command on.</param>
    /// <param name="command">The command to execute.</param>
    /// <param name="logger">The <see cref="ILogger"/> to report a failure to.</param>
    /// <param name="caller">The member issuing the command - supplied automatically by the compiler.</param>
    /// <returns>The <see cref="CommandResult"/> from executing the command.</returns>
    /// <remarks>
    /// This changes nothing about how a failure is handled - it only makes it observable. A caller
    /// that must react to failure (retry, throw, surface to a user) keeps inspecting the returned
    /// <see cref="CommandResult"/> itself; this is only for the sites that previously discarded it
    /// outright.
    /// </remarks>
    public static async Task<CommandResult> ExecuteAndReport(
        this ICommandPipeline commandPipeline,
        object command,
        ILogger logger,
        [CallerMemberName] string? caller = null)
    {
        var result = await commandPipeline.Execute(command);

        // Null-safe on purpose: a real pipeline never returns null, but a test double left
        // unconfigured does, and that must not turn "nobody is checking the result" into an
        // unrelated NullReferenceException.
        if (result?.IsSuccess == false)
        {
            logger.CommandNotSuccessful(command.GetType().Name, caller ?? string.Empty, result.Describe());
        }

        // Never actually null from a real pipeline - the null-conditional check above is what makes
        // the compiler's flow analysis lose track of that between here and there.
        return result!;
    }

    /// <summary>
    /// Why a command was refused or failed, in one line for the log.
    /// </summary>
    /// <param name="result">The refused or failed <see cref="CommandResult"/>.</param>
    /// <returns>The reason.</returns>
    internal static string Describe(this CommandResult result)
    {
        if (!result.IsAuthorized)
        {
            return "the command was not authorized";
        }

        if (result.HasExceptions)
        {
            return string.Join("; ", result.ExceptionMessages);
        }

        return result.ValidationResults.Any()
            ? string.Join("; ", result.ValidationResults.Select(validation => validation.Message))
            : "the command was refused without saying why";
    }
}
