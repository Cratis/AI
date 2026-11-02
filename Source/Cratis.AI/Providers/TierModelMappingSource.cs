// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The recorded origin of the current complete tier table.
/// </summary>
public enum TierModelMappingSource
{
    /// <summary>No derivation recorded: the operator's selection, or any table recorded before derivations were marked.</summary>
    Unknown = 0,

    /// <summary>Discovery derived the table from a catalog.</summary>
    Derived = 1
}
