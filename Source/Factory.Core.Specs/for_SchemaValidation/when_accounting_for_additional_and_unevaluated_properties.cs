// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.for_SchemaValidation;

public class when_accounting_for_additional_and_unevaluated_properties : Specification
{
    const string AdditionalSchemaId = "https://schemas.cratis.io/factory/tests/additional-cost.schema.json";
    const string UnevaluatedSchemaId = "https://schemas.cratis.io/factory/tests/unevaluated-cost.schema.json";
    const string CombinedSchemaId = "https://schemas.cratis.io/factory/tests/combined-object-cost.schema.json";
    SchemaValidationResult _additional = null!;
    SchemaValidationResult _unevaluated = null!;
    SchemaValidationResult _combined = null!;

    void Because()
    {
        var instance = CreateObjectInstance(8_000);
        _additional = Load(AdditionalSchemaId, "\"additionalProperties\":true").Validate(AdditionalSchemaId, instance);
        _unevaluated = Load(UnevaluatedSchemaId, "\"unevaluatedProperties\":true").Validate(UnevaluatedSchemaId, instance);
        _combined = Load(CombinedSchemaId, "\"additionalProperties\":true,\"unevaluatedProperties\":true").Validate(CombinedSchemaId, instance);
    }

    [Fact] void should_admit_the_additional_properties_cost_by_itself() => _additional.Status.ShouldEqual(SchemaValidationStatus.Valid);
    [Fact] void should_admit_the_unevaluated_properties_cost_by_itself() => _unevaluated.Status.ShouldEqual(SchemaValidationStatus.Valid);
    [Fact] void should_reject_the_combined_cost() => _combined.Status.ShouldEqual(SchemaValidationStatus.EvaluationLimitExceeded);
    [Fact] void should_report_the_evaluation_work_limit() => _combined.Diagnostics.Select(_ => _.Code).ShouldContainOnly(SchemaDiagnosticCode.EvaluationWorkLimitExceeded);

    static SchemaResourceSet Load(string schemaId, string keyword) =>
        SchemaResourceSet.Load(
            [new(
                schemaId,
                Encoding.UTF8.GetBytes($$"""{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"{{schemaId}}","type":"object",{{keyword}}}"""))])
            .ResourceSet!;

    static byte[] CreateObjectInstance(int propertyCount)
    {
        var destination = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(destination))
        {
            writer.WriteStartObject();
            for (var index = 0; index < propertyCount; index++)
            {
                writer.WriteNumber($"p{index:D4}", index);
            }

            writer.WriteEndObject();
        }

        return destination.WrittenSpan.ToArray();
    }
}
