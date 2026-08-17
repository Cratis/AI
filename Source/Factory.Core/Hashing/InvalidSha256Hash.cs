// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Hashing;

/// <summary>
/// The exception that is thrown when a value is not a strict lowercase prefixed SHA-256 identifier.
/// </summary>
public sealed class InvalidSha256Hash : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="InvalidSha256Hash"/> class.
    /// </summary>
    internal InvalidSha256Hash()
        : base("The SHA-256 identifier is malformed.")
    {
    }
}
