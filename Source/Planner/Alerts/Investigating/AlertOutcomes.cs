// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.RegularExpressions;
using Planner.Work.Workers;

namespace Planner.Alerts.Investigating;

/// <summary>
/// Reads the verdict out of what an agent reported back from investigating an alert.
/// </summary>
public static partial class AlertOutcomes
{
    [GeneratedRegex(@"^ALERT-OUTCOME:[ \t]*(?<outcome>[\w-]+)[ \t]*$", RegexOptions.Multiline, 1000)]
    private static partial Regex OutcomeExpression { get; }

    /// <summary>
    /// Finds the outcome an alert investigation ended with through its marker line.
    /// </summary>
    /// <param name="result">The reported result text.</param>
    /// <returns>
    /// The outcome. An agent that did not say defaults to
    /// <see cref="AlertInvestigationOutcome.NeedsAttention"/> - a silent session is not evidence that
    /// production is fine, and an alert wrongly left open costs a glance where one wrongly closed
    /// costs an outage.
    /// </returns>
    public static AlertInvestigationOutcome Read(string result)
    {
        var match = OutcomeExpression.Match(result ?? string.Empty);
        return match.Success && match.Groups["outcome"].Value.Equals(WorkerPrompts.AlertResolvedOutcome, StringComparison.OrdinalIgnoreCase)
            ? AlertInvestigationOutcome.Resolved
            : AlertInvestigationOutcome.NeedsAttention;
    }
}
