// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Canonicalization;

/// <summary>
/// The exception that is thrown when input cannot be represented as Factory canonical JSON version 1.
/// </summary>
public sealed class InvalidCanonicalJson : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="InvalidCanonicalJson"/> class.
    /// </summary>
    /// <param name="failure">The bounded rejection information.</param>
    internal InvalidCanonicalJson(CanonicalJsonFailure failure)
        : base($"Factory canonical JSON is invalid ({failure.Code}).")
    {
        Failure = failure;
    }

    /// <summary>
    /// Gets bounded rejection information that never includes input or parser-provided text.
    /// </summary>
    public CanonicalJsonFailure Failure { get; }
}
