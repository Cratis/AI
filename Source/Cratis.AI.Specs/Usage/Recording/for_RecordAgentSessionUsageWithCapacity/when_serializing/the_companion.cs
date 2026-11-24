// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Chronicle.Compliance;
using Cratis.Chronicle.Confidentiality;
using Cratis.Chronicle.Schemas;
using Cratis.Json;
using Cratis.Serialization;

namespace Cratis.AI.Usage.Recording.for_RecordAgentSessionUsageWithCapacity.when_serializing;

public class the_companion : given.a_usage_boundary
{
    AgentSessionCapacityObserved _event;
    AgentSessionCapacityObserved _roundTrip;
    string _schema;
    int _validationErrors;
    void Because()
    {
        var naming = new DefaultNamingPolicy();
        var options = new JsonSerializerOptions { PropertyNamingPolicy = naming.JsonPropertyNamingPolicy, Converters = { new ConceptAsJsonConverterFactory() } };
        _event = new(_session, _command.Agent, _command.Purpose, AgentSessionCapacityBoundaryKind.UsageRecorded, _snapshot);
        var json = JsonSerializer.Serialize(_event, options);
        _roundTrip = JsonSerializer.Deserialize<AgentSessionCapacityObserved>(json, options)!;
        var generator = new JsonSchemaGenerator(Substitute.For<IComplianceMetadataResolver>(), Substitute.For<ISecurityMetadataResolver>(), naming, Substitute.For<IDerivedTypes>());
        var schema = generator.Generate(typeof(AgentSessionCapacityObserved));
        _schema = schema.ToJson();
        _validationErrors = schema.Validate(json).Count;
    }
    [Fact] void should_generate_a_schema_that_accepts_the_event() => _validationErrors.ShouldEqual(0);
    [Fact] void should_have_no_nullable_event_values_in_the_schema() => _schema.Contains("\"null\"", StringComparison.Ordinal).ShouldBeFalse();
    [Fact] void should_round_trip_the_stream_correlation() => _roundTrip.Session.ShouldEqual(_event.Session);
    [Fact] void should_round_trip_the_nested_windows() => _roundTrip.Snapshot.Windows.ShouldEqual(_event.Snapshot.Windows);
    [Fact] void should_round_trip_the_actual_provider() => _roundTrip.Snapshot.Provider.ShouldEqual(_provider);
    [Fact] void should_name_the_usage_recorded_boundary() => _roundTrip.Boundary.ShouldEqual(AgentSessionCapacityBoundaryKind.UsageRecorded);
}
