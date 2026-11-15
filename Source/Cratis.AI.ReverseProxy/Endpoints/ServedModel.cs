// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.Endpoints;

/// <summary>
/// One model an endpoint serves.
/// </summary>
/// <param name="Name">The name callers send as <c>model</c>, exactly as the backend knows it.</param>
/// <param name="DisplayName">A friendlier name for people; empty when there is none.</param>
/// <param name="ContextWindow">The context window in tokens; zero when not known.</param>
public record ServedModel(string Name, string DisplayName = "", int ContextWindow = 0);
