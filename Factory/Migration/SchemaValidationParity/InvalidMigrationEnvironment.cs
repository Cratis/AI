// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidationParity;

sealed class InvalidMigrationEnvironment : Exception;

sealed class InvalidVectorManifest(string code = "manifest-invalid") : Exception
{
    public string Code { get; } = code;
}
