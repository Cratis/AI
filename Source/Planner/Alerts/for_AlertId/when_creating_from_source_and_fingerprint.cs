// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Alerts.for_AlertId;

public class when_creating_from_source_and_fingerprint : Specification
{
    AlertId _readable;
    AlertId _sameConditionAgain;
    AlertId _long;
    AlertId _longSharingAPrefix;

    void Because()
    {
        _readable = AlertId.From("Studio Production", "pod:studio/loki-0:CrashLoopBackOff");
        _sameConditionAgain = AlertId.From("Studio Production", "pod:studio/loki-0:CrashLoopBackOff");
        _long = AlertId.From("studio", new string('a', 400) + "-one");
        _longSharingAPrefix = AlertId.From("studio", new string('a', 400) + "-two");
    }

    [Fact] void should_slugify_the_source_and_fingerprint() => _readable.Value.ShouldEqual("studio-production-pod-studio-loki-0-crashloopbackoff");
    [Fact] void should_be_the_same_identity_for_the_same_condition() => _sameConditionAgain.ShouldEqual(_readable);
    [Fact] void should_bound_the_length_of_a_long_fingerprint() => _long.Value.Length.ShouldBeLessThan(161);
    [Fact] void should_keep_long_fingerprints_sharing_a_prefix_apart() => _longSharingAPrefix.ShouldNotEqual(_long);
}
#endif
