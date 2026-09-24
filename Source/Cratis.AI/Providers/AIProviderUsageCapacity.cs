// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The token ceiling one configured AI provider is allowed to consume within its usage-reporting
/// window - the vendor's trailing-30-day organization usage report where one is configured, or
/// Direct's own trailing-week burn otherwise (see <see cref="Pools.IProviderBurn"/>). Zero -
/// <see cref="NotSet"/> - means no ceiling is configured, which is what a provider starts with:
/// capacity-aware selection simply does not apply to it until somebody sets one, and it falls back
/// to the existing least-burnt ranking (issue #1061).
/// </summary>
/// <param name="Value">The underlying value, in tokens.</param>
public record AIProviderUsageCapacity(long Value) : ConceptAs<long>(Value)
{
    /// <summary>
    /// The value representing no configured ceiling.
    /// </summary>
    public static readonly AIProviderUsageCapacity NotSet = new(0L);

    /// <summary>
    /// Gets a value indicating whether a ceiling is actually configured.
    /// </summary>
    public bool IsLimited => Value > 0;

    /// <summary>
    /// Implicitly convert from <see cref="long"/> to <see cref="AIProviderUsageCapacity"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AIProviderUsageCapacity(long value) => new(value);
}

/// <summary>
/// Validates that an <see cref="AIProviderUsageCapacity"/> is a bound that can mean something,
/// wherever it appears. Zero is allowed and means no ceiling; a negative one is not a smaller
/// ceiling, it is nonsense.
/// </summary>
public class AIProviderUsageCapacityValidator : ConceptValidator<AIProviderUsageCapacity>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AIProviderUsageCapacityValidator"/> class.
    /// </summary>
    public AIProviderUsageCapacityValidator() =>
        RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("A usage capacity cannot be negative - use zero for no ceiling");
}
