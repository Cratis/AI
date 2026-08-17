// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Hashing;

/// <summary>
/// The exception that is thrown when an unknown canonical JSON self-hash field is requested.
/// </summary>
public sealed class InvalidCanonicalJsonSelfHashField : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="InvalidCanonicalJsonSelfHashField"/> class.
    /// </summary>
    internal InvalidCanonicalJsonSelfHashField()
        : base("The canonical JSON self-hash field is unknown.")
    {
    }
}
