// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Configuration;

/// <summary>
/// Thrown by <see cref="CratisAIServiceCollectionExtensions.AddCratisAI"/> when <c>Cratis.AI</c>'s
/// sentinel type is not present in the host's type universe immediately after registration - almost
/// always because <c>AddCratisAI()</c> was called after <c>AddCratisArc()</c>/<c>AddChronicle()</c>
/// rather than before. See <see cref="CratisAISentinel"/> and plan Section 12.2 step 3.
/// </summary>
public sealed class CratisAIOrderingViolation() : Exception(
    "Cratis.AI was not visible in the host's type universe right after AddCratisAI() ran. " +
    "AddCratisAI() must be called before AddCratisArc() and AddChronicle() - calling any method on a " +
    "Cratis.AI type forces the CLR to load the assembly, which runs its module initializer, which " +
    "registers its type-discovery provider, all before Arc/Chronicle snapshot the type universe. " +
    "See Cratis.AI's README and AI-consolidation-plan.md Section 12.2 step 3.");
