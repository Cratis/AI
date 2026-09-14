// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// How many worker sessions may run on one configured AI provider at the same time. Zero -
/// <see cref="NotSet"/> - means no limit, which is what a provider starts with and what every
/// provider configured before this existed replays as: the bound is opt-in, so adding it changes
/// nothing until someone sets one. Ported from Direct's <c>AIProviders.MaxConcurrentJobs</c> (plan
/// Section 5.2 step 6).
/// </summary>
/// <remarks>
/// This is the dispatch-time bound on <em>worker containers</em>, and is a different thing from a
/// provider's own in-flight-completions concurrency gate (plan Section 5.2 step 6,
/// <c>ProviderConcurrencyGate</c>). A worker session occupies its provider for as long as the
/// container runs - minutes to hours - so the two are paced on entirely different scales and
/// deliberately do not share a number.
/// </remarks>
/// <param name="Value">The underlying value.</param>
public record MaxConcurrentJobs(int Value) : ConceptAs<int>(Value)
{
    /// <summary>
    /// The value representing no configured limit - the provider takes as much work as any
    /// consumer-wide bound allows.
    /// </summary>
    public static readonly MaxConcurrentJobs NotSet = new(0);

    /// <summary>
    /// Gets a value indicating whether a limit is actually configured.
    /// </summary>
    public bool IsLimited => Value > 0;

    /// <summary>
    /// Implicitly convert from <see cref="int"/> to <see cref="MaxConcurrentJobs"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator MaxConcurrentJobs(int value) => new(value);

    /// <summary>
    /// Whether a provider already running the given number of worker sessions has room for another.
    /// </summary>
    /// <param name="running">How many sessions are already running on the provider.</param>
    /// <returns><see langword="true"/> when another session may start.</returns>
    public bool HasCapacityFor(int running) => !IsLimited || running < Value;
}

/// <summary>
/// Validates that a <see cref="MaxConcurrentJobs"/> is a bound that can mean something, wherever it
/// appears. Zero is allowed and means no limit; a negative bound is not a smaller limit, it is
/// nonsense, and would read as "no capacity, ever" to <see cref="MaxConcurrentJobs.HasCapacityFor"/>.
/// </summary>
public class MaxConcurrentJobsValidator : ConceptValidator<MaxConcurrentJobs>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="MaxConcurrentJobsValidator"/> class.
    /// </summary>
    public MaxConcurrentJobsValidator() =>
        RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("A concurrency limit cannot be negative - use zero for no limit");
}
