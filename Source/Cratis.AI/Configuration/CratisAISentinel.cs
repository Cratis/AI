// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Configuration;

/// <summary>
/// Exists only to be found. <see cref="CratisAIServiceCollectionExtensions.AddCratisAI"/> asserts this
/// type is present in <c>Cratis.Types.Types.Instance.All</c> after registering, and throws a
/// self-explaining exception if it is not - see plan Section 12.2 step 3 ("fail loudly instead of
/// silently"). A missing sentinel means the host's type universe was snapshotted before
/// <c>Cratis.AI</c>'s module initializer ran, almost always because <c>AddCratisAI()</c> was called
/// after <c>AddCratisArc()</c>/<c>AddChronicle()</c> instead of before.
/// </summary>
public static class CratisAISentinel;
