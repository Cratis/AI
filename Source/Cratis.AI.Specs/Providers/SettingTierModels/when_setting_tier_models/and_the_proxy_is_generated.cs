// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingTierModels.when_setting_tier_models;

public class and_the_proxy_is_generated : Specification
{
    string _proxy;

    void Because()
    {
        using var stream = typeof(and_the_proxy_is_generated).Assembly.GetManifestResourceStream("LegacyTierModelsProxy")!;
        using var reader = new StreamReader(stream);
        _proxy = reader.ReadToEnd();
    }

    [Fact]
    void should_preserve_the_published_legacy_route() =>
        _proxy.ShouldContain("readonly route: string = '/api/a-i/providers/setting-tier-models';");
}
