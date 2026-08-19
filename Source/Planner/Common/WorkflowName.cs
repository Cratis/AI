// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The name of a GitHub Actions workflow, as shown in the Actions tab.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record WorkflowName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unknown workflow.
    /// </summary>
    public static readonly WorkflowName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="WorkflowName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator WorkflowName(string value) => new(value);
}
