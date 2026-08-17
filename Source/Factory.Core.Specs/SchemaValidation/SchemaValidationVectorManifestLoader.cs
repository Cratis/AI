// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Serialization;

namespace Cratis.Factory.SchemaValidation.Conformance;

static class SchemaValidationVectorManifestLoader
{
    static readonly JsonSerializerOptions _serializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    public static string ManifestPath { get; } = Path.Combine(AppContext.BaseDirectory, "Fixtures", "schema-validation-vectors.json");

    public static SchemaValidationVectorManifest Load() => Load(File.ReadAllBytes(ManifestPath));

    public static SchemaValidationVectorManifest Load(ReadOnlySpan<byte> utf8)
    {
        StrictManifestShape.Validate(utf8);
        var manifest = JsonSerializer.Deserialize<SchemaValidationVectorManifest>(utf8, _serializerOptions) ??
                       throw new InvalidDataException("The schema validation vector manifest is empty.");
        SchemaValidationVectorManifestValidator.Validate(manifest, utf8);
        return manifest;
    }
}
