// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Text.Json;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Hashing;

namespace Cratis.Factory.SchemaValidation;

static class SchemaIdentity
{
    public static Sha256Hash Calculate(IEnumerable<LoadedSchemaDocument> documents, string? rootSchemaId = null)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString(
                "algorithm",
                rootSchemaId is null ? "factory-schema-resource-set-v1" : "factory-schema-closure-v1");
            writer.WritePropertyName("documents");
            writer.WriteStartArray();
            foreach (var document in documents.OrderBy(_ => _.SchemaId, StringComparer.Ordinal))
            {
                writer.WriteStartObject();
                writer.WriteString("contentHash", document.ContentHash.Value);
                writer.WriteString("schemaId", document.SchemaId);
                writer.WriteEndObject();
            }

            writer.WriteEndArray();
            if (rootSchemaId is not null)
            {
                writer.WriteString("root", rootSchemaId);
            }

            writer.WriteEndObject();
        }

        var canonical = CanonicalJson.Parse(buffer.WrittenSpan);
        return Sha256Hash.Calculate(canonical.Utf8);
    }
}
