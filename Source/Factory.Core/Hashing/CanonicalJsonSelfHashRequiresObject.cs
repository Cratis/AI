// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Hashing;

/// <summary>
/// The exception that is thrown when self-hash calculation is requested for a non-object canonical root.
/// </summary>
public sealed class CanonicalJsonSelfHashRequiresObject : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="CanonicalJsonSelfHashRequiresObject"/> class.
    /// </summary>
    internal CanonicalJsonSelfHashRequiresObject()
        : base("Canonical JSON self hashing requires an object root.")
    {
    }
}
