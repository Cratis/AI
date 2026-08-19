// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Builds.Analyzing.for_BuildAssessment.when_parsing;

public class and_the_response_is_plain_json : Specification
{
    BuildAssessment? _result;

    void Because() => _result = BuildAssessment.Parse(
        """
        { "diagnosis": "A dependency bump broke the build", "fixable": true }
        """);

    [Fact] void should_parse_the_diagnosis() => _result!.Diagnosis.ShouldEqual(new BuildDiagnosis("A dependency bump broke the build"));
    [Fact] void should_parse_fixable() => Assert.True(_result!.Fixable);
}
#endif
