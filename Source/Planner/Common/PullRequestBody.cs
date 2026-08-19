// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The markdown body of a pull request.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record PullRequestBody(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing a pull request without a body.
    /// </summary>
    public static readonly PullRequestBody NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="PullRequestBody"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator PullRequestBody(string value) => new(value);
}
