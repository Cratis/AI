// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The exception that is thrown when an encrypted envelope remains at the credential-use boundary.
/// Its message and data never contain the credential.
/// </summary>
public class AIProviderRequiresReconfiguration() : Exception("This AI provider has an unsupported encrypted credential. Reconfigure its credentials in AI settings before using it.");
