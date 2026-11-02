// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The recorded origin of the current complete tier table; legacy tables have no known origin.
/// </summary>
public enum TierModelMappingSource
{
    /// <summary>Legacy table without recorded provenance, retained for backward-compatible resolution.</summary>
    Unknown = 0,

    /// <summary>An operator deliberately saved the complete table.</summary>
    Explicit = 1,

    /// <summary>Discovery derived the table from a catalog.</summary>
    Derived = 2
}
