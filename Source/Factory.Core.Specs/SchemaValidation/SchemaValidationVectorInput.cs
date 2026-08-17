// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation.Conformance;

static class SchemaValidationVectorInput
{
    const string Draft = "https://json-schema.org/draft/2020-12/schema";

    public static IReadOnlyList<VectorSchemaDocument> CreateSchemaDocuments(SchemaValidationVectorManifest manifest, SchemaValidationVector vector) =>
        vector.SchemaDocuments is not null
            ? [.. vector.SchemaDocuments.Select(key => manifest.Documents.TryGetValue(key, out var document)
                ? new VectorSchemaDocument(document.LogicalId, Convert.FromBase64String(document.InputBase64))
                : throw new InvalidDataException($"Schema validation vector '{vector.Id}' references unknown document key '{key}'."))]
            : CreateSchemaDocuments(vector.SchemaGenerator!);

    public static byte[]? CreateInstance(SchemaValidationVector vector)
    {
        if (vector.InstanceBase64 is not null)
        {
            return Convert.FromBase64String(vector.InstanceBase64);
        }

        return vector.InstanceGenerator is null ? null : CreateInstance(vector.InstanceGenerator);
    }

    static IReadOnlyList<VectorSchemaDocument> CreateSchemaDocuments(SchemaValidationVectorGenerator generator) => generator.Kind switch
    {
        "documentCount" => CreateBooleanDocuments(generator),
        "aggregateSchemaBytes" => CreateAggregateBytesDocuments(generator),
        "resourceCount" => [CreateNestedResourceDocument(generator)],
        "anchorCount" => [CreateAnchorDocument(generator)],
        "anchorScalars" => [CreateScalarBoundDocument(generator, "$anchor")],
        "embeddedRootSiblingSchemaNodes" => [CreateEmbeddedRootSiblingSchemaDocument(generator)],
        "evaluationPathMultiplicity" => [CreateEvaluationPathMultiplicityDocument(generator)],
        "patternScalars" => [CreateScalarBoundDocument(generator, "pattern")],
        "referenceDepth" => [CreateReferenceDepthDocument(generator)],
        "referenceEdgeCount" => [CreateReferenceEdgeDocument(generator)],
        "referenceScalars" => CreateReferenceScalarDocuments(generator),
        "schemaDepth" => [CreateSchemaDepthDocument(generator)],
        "schemaDocumentBytes" => [CreateSchemaDocumentBytesDocument(generator)],
        "schemaIdScalars" => [new(CreateFixedLength(generator.SchemaIdPrefix!, generator.Count), "true"u8.ToArray())],
        "schemaNodeCount" => [CreateSchemaNodeCountDocument(generator)],
        _ => throw new InvalidDataException($"Unsupported schema validation document generator '{generator.Kind}'.")
    };

    static byte[] CreateInstance(SchemaValidationVectorGenerator generator) => generator.Kind switch
    {
        "diagnosticCount" => Encoding.UTF8.GetBytes($"[{string.Join(',', Enumerable.Repeat("\"invalid\"", generator.Count))}]"),
        "instanceBytes" => CreateInstanceBytes(generator),
        "instanceDepth" => Encoding.UTF8.GetBytes($"{new string('[', generator.Count)}null{new string(']', generator.Count)}"),
        "instanceNodeCount" => CreateInstanceNodeCount(generator),
        "instanceStringScalars" => Encoding.UTF8.GetBytes($"\"{new string('a', generator.Count)}\""),
        "patternAdversarialInput" => Encoding.UTF8.GetBytes($"\"{new string('a', generator.Count)}!\""),
        "productiveRecursionDepth" => CreateProductiveRecursionInstance(generator),
        "uniqueObjectArray" => CreateUniqueObjectArray(generator, lateDuplicate: false),
        "uniqueObjectArrayLateDuplicate" => CreateUniqueObjectArray(generator, lateDuplicate: true),
        _ => throw new InvalidDataException($"Unsupported schema validation instance generator '{generator.Kind}'.")
    };

    static IReadOnlyList<VectorSchemaDocument> CreateBooleanDocuments(SchemaValidationVectorGenerator generator) =>
        [.. Enumerable.Range(0, generator.Count)
            .Select(index => new VectorSchemaDocument(CreateSchemaId(generator, index), "true"u8.ToArray()))];

    static IReadOnlyList<VectorSchemaDocument> CreateAggregateBytesDocuments(SchemaValidationVectorGenerator generator)
    {
        var documents = Enumerable.Range(0, generator.Count)
            .Select(index => new AggregateDocument(CreateSchemaId(generator, index)))
            .ToArray();
        var remaining = generator.TargetBytes!.Value - documents.Sum(_ => _.MinimumByteLength);
        if (remaining < 0)
        {
            throw new InvalidDataException("The aggregate byte generator target is smaller than its schema framing.");
        }

        for (var index = 0; index < documents.Length; index++)
        {
            var share = remaining / (documents.Length - index);
            documents[index].DescriptionLength = share;
            remaining -= share;
        }

        return [.. documents.Select(_ => new VectorSchemaDocument(_.SchemaId, _.CreateBytes()))];
    }

    static VectorSchemaDocument CreateNestedResourceDocument(SchemaValidationVectorGenerator generator)
    {
        var schemaId = CreateSchemaId(generator, 0);
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            writer.WriteStartObject();
            writer.WriteString("$schema", Draft);
            writer.WriteString("$id", schemaId);
            writer.WriteStartObject("$defs");
            for (var index = 1; index < generator.Count; index++)
            {
                writer.WriteStartObject($"resource{index:D4}");
                writer.WriteString("$id", CreateSchemaId(generator, index));
                writer.WriteString("type", "null");
                writer.WriteEndObject();
            }

            writer.WriteEndObject();
            writer.WriteEndObject();
        }

        return new(schemaId, destination.WrittenSpan.ToArray());
    }

    static VectorSchemaDocument CreateResourceChainDocument(SchemaValidationVectorGenerator generator)
    {
        var schemaId = CreateSchemaId(generator, 0);
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            writer.WriteStartObject();
            writer.WriteString("$schema", Draft);
            writer.WriteString("$id", schemaId);
            writer.WriteStartObject("$defs");
            for (var index = 1; index < generator.Count; index++)
            {
                writer.WriteStartObject($"resource{index:D4}");
                writer.WriteString("$id", CreateSchemaId(generator, index));
                if (index + 1 < generator.Count)
                {
                    writer.WriteString("$ref", CreateSchemaId(generator, index + 1));
                }
                else
                {
                    writer.WriteString("type", "null");
                }

                writer.WriteEndObject();
            }

            writer.WriteEndObject();
            writer.WriteString("$ref", generator.Count == 1 ? "#" : CreateSchemaId(generator, 1));
            writer.WriteEndObject();
        }

        return new(schemaId, destination.WrittenSpan.ToArray());
    }

    static VectorSchemaDocument CreateReferenceDepthDocument(SchemaValidationVectorGenerator generator) =>
        CreateResourceChainDocument(generator with { Count = generator.Count + 1 });

    static VectorSchemaDocument CreateSchemaNodeCountDocument(SchemaValidationVectorGenerator generator)
    {
        var schemaId = CreateSchemaId(generator, 0);
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            writer.WriteStartObject();
            writer.WriteString("$schema", Draft);
            writer.WriteString("$id", schemaId);
            writer.WriteStartObject("$defs");
            for (var index = 1; index < generator.Count; index++)
            {
                writer.WriteBoolean($"node{index:D5}", true);
            }
            writer.WriteEndObject();
            writer.WriteEndObject();
        }

        return new(schemaId, destination.WrittenSpan.ToArray());
    }

    static VectorSchemaDocument CreateEvaluationPathMultiplicityDocument(SchemaValidationVectorGenerator generator)
    {
        var schemaId = CreateSchemaId(generator, 0);
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            writer.WriteStartObject();
            writer.WriteString("$schema", Draft);
            writer.WriteString("$id", schemaId);
            writer.WriteStartObject("$defs");
            for (var layer = 1; layer <= generator.Count; layer++)
            {
                writer.WritePropertyName($"node{layer:D4}");
                if (layer == generator.Count)
                {
                    writer.WriteBooleanValue(true);
                    continue;
                }

                writer.WriteStartObject();
                WriteConvergingReferences(writer, layer + 1);
                writer.WriteEndObject();
            }

            writer.WriteEndObject();
            writer.WriteString("pattern", "^a+$");
            WriteConvergingReferences(writer, 1);
            writer.WriteEndObject();
        }

        return new(schemaId, destination.WrittenSpan.ToArray());
    }

    static void WriteConvergingReferences(Utf8JsonWriter writer, int targetLayer)
    {
        writer.WriteStartArray("allOf");
        for (var branch = 0; branch < 2; branch++)
        {
            writer.WriteStartObject();
            writer.WriteString("$ref", $"#/$defs/node{targetLayer:D4}");
            writer.WriteEndObject();
        }

        writer.WriteEndArray();
    }

    static VectorSchemaDocument CreateEmbeddedRootSiblingSchemaDocument(SchemaValidationVectorGenerator generator)
    {
        if (generator.Count < 3)
        {
            throw new InvalidDataException("The embedded-root sibling generator requires at least three schema nodes.");
        }

        var schemaId = CreateSchemaId(generator, 0);
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            writer.WriteStartObject();
            writer.WriteString("$schema", Draft);
            writer.WriteString("$id", schemaId);
            writer.WriteStartObject("$defs");
            writer.WriteStartObject("selected");
            writer.WriteString("$id", CreateSchemaId(generator, 1));
            writer.WriteString("type", "array");
            writer.WriteEndObject();
            writer.WriteStartObject("sibling");
            writer.WriteString("$id", CreateSchemaId(generator, 2));
            writer.WriteStartObject("$defs");
            for (var index = 3; index < generator.Count; index++)
            {
                writer.WriteBoolean($"node{index:D5}", true);
            }
            writer.WriteEndObject();
            writer.WriteEndObject();
            writer.WriteEndObject();
            writer.WriteEndObject();
        }

        return new(schemaId, destination.WrittenSpan.ToArray());
    }

    static VectorSchemaDocument CreateAnchorDocument(SchemaValidationVectorGenerator generator)
    {
        var schemaId = CreateSchemaId(generator, 0);
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            writer.WriteStartObject();
            writer.WriteString("$schema", Draft);
            writer.WriteString("$id", schemaId);
            writer.WriteStartObject("$defs");
            for (var index = 0; index < generator.Count; index++)
            {
                writer.WriteStartObject($"anchor{index:D4}");
                writer.WriteString("$anchor", $"anchor{index:D4}");
                writer.WriteString("type", "null");
                writer.WriteEndObject();
            }

            writer.WriteEndObject();
            writer.WriteEndObject();
        }

        return new(schemaId, destination.WrittenSpan.ToArray());
    }

    static VectorSchemaDocument CreateReferenceEdgeDocument(SchemaValidationVectorGenerator generator)
    {
        var schemaId = CreateSchemaId(generator, 0);
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            writer.WriteStartObject();
            writer.WriteString("$schema", Draft);
            writer.WriteString("$id", schemaId);
            writer.WriteStartObject("$defs");
            writer.WriteBoolean("target", true);
            writer.WriteEndObject();
            writer.WriteStartArray("allOf");
            for (var index = 0; index < generator.Count; index++)
            {
                writer.WriteStartObject();
                writer.WriteString("$ref", "#/$defs/target");
                writer.WriteEndObject();
            }

            writer.WriteEndArray();
            writer.WriteEndObject();
        }

        return new(schemaId, destination.WrittenSpan.ToArray());
    }

    static VectorSchemaDocument CreateScalarBoundDocument(SchemaValidationVectorGenerator generator, string keyword)
    {
        var schemaId = CreateSchemaId(generator, 0);
        var value = new string('a', generator.Count);
        return new(schemaId, Encoding.UTF8.GetBytes($"{{\"$schema\":\"{Draft}\",\"$id\":\"{schemaId}\",\"{keyword}\":\"{value}\",\"type\":\"string\"}}"));
    }

    static IReadOnlyList<VectorSchemaDocument> CreateReferenceScalarDocuments(SchemaValidationVectorGenerator generator)
    {
        var schemaId = CreateSchemaId(generator, 0);
        var targetId = CreateFixedLength("https://r/", generator.Count);
        var root = new VectorSchemaDocument(schemaId, Encoding.UTF8.GetBytes($"{{\"$schema\":\"{Draft}\",\"$id\":\"{schemaId}\",\"$ref\":\"{targetId}\"}}"));
        if (generator.Count > SchemaValidationLimits.MaximumReferenceScalars)
        {
            return [root];
        }

        var target = new VectorSchemaDocument(targetId, "true"u8.ToArray());
        return [root, target];
    }

    static VectorSchemaDocument CreateSchemaDocumentBytesDocument(SchemaValidationVectorGenerator generator)
    {
        var schemaId = CreateSchemaId(generator, 0);
        var minimum = Encoding.UTF8.GetBytes($"{{\"$schema\":\"{Draft}\",\"$id\":\"{schemaId}\",\"description\":\"\",\"title\":\"\"}}");
        var remaining = generator.TargetBytes!.Value - minimum.Length;
        if (remaining < 0)
        {
            throw new InvalidDataException("The schema document byte generator target is smaller than its framing.");
        }

        var descriptionLength = remaining / 2;
        var titleLength = remaining - descriptionLength;
        return new(schemaId, Encoding.UTF8.GetBytes($"{{\"$schema\":\"{Draft}\",\"$id\":\"{schemaId}\",\"description\":\"{new string('a', descriptionLength)}\",\"title\":\"{new string('b', titleLength)}\"}}"));
    }

    static VectorSchemaDocument CreateSchemaDepthDocument(SchemaValidationVectorGenerator generator)
    {
        var schemaId = CreateSchemaId(generator, 0);
        var prefix = $"{{\"$schema\":\"{Draft}\",\"$id\":\"{schemaId}\",";
        var nested = string.Concat(Enumerable.Repeat("\"not\":{", generator.Count - 1));
        var suffix = new string('}', generator.Count);
        return new(schemaId, Encoding.UTF8.GetBytes($"{prefix}{nested}\"not\":true{suffix}"));
    }

    static byte[] CreateInstanceBytes(SchemaValidationVectorGenerator generator)
    {
        const int framingBytes = 7;
        var remaining = generator.TargetBytes!.Value - framingBytes;
        if (remaining < 0)
        {
            throw new InvalidDataException("The instance byte generator target is smaller than its array framing.");
        }

        var firstLength = remaining / 2;
        var secondLength = remaining - firstLength;
        return Encoding.UTF8.GetBytes($"[\"{new string('a', firstLength)}\",\"{new string('b', secondLength)}\"]");
    }

    static byte[] CreateInstanceNodeCount(SchemaValidationVectorGenerator generator)
    {
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            writer.WriteStartArray();
            for (var index = 1; index < generator.Count; index++)
            {
                writer.WriteNullValue();
            }
            writer.WriteEndArray();
        }

        return destination.WrittenSpan.ToArray();
    }

    static byte[] CreateProductiveRecursionInstance(SchemaValidationVectorGenerator generator)
    {
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            for (var depth = 0; depth < generator.Count; depth++)
            {
                writer.WriteStartObject();
                writer.WritePropertyName("next");
            }

            writer.WriteNullValue();
            for (var depth = 0; depth < generator.Count; depth++)
            {
                writer.WriteEndObject();
            }
        }

        return destination.WrittenSpan.ToArray();
    }

    static byte[] CreateUniqueObjectArray(SchemaValidationVectorGenerator generator, bool lateDuplicate)
    {
        if (lateDuplicate && generator.Count < 2)
        {
            throw new InvalidDataException("The late-duplicate unique object generator requires at least two items.");
        }

        var payload = new string('a', generator.TargetBytes!.Value);
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            writer.WriteStartArray();
            for (var index = 0; index < generator.Count; index++)
            {
                writer.WriteStartObject();
                if (lateDuplicate && index == generator.Count - 1)
                {
                    writer.WriteString("payload", payload);
                    writer.WriteNumber("ordinal", 0);
                }
                else
                {
                    writer.WriteNumber("ordinal", index);
                    writer.WriteString("payload", payload);
                }

                writer.WriteEndObject();
            }

            writer.WriteEndArray();
        }

        return destination.WrittenSpan.ToArray();
    }

    static string CreateFixedLength(string prefix, int length)
    {
        if (prefix.Length > length)
        {
            throw new InvalidDataException("The scalar-bound generator prefix exceeds the requested length.");
        }

        return $"{prefix}{new string('a', length - prefix.Length)}";
    }

    static string CreateSchemaId(SchemaValidationVectorGenerator generator, int index) => $"{generator.SchemaIdPrefix}{index:D4}.schema.json";

    sealed class AggregateDocument(string schemaId)
    {
        public string SchemaId { get; } = schemaId;
        public int DescriptionLength { get; set; }
        public int MinimumByteLength => CreateBytes().Length;

        public byte[] CreateBytes() => Encoding.UTF8.GetBytes($"{{\"$schema\":\"{Draft}\",\"$id\":\"{SchemaId}\",\"description\":\"{new string('a', DescriptionLength)}\"}}");
    }
}

sealed record VectorSchemaDocument(string LogicalId, byte[] Utf8);
