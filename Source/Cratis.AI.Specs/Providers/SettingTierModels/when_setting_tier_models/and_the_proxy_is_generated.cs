// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Proxies;

namespace Cratis.AI.Providers.SettingTierModels.when_setting_tier_models;

/// <summary>
/// The published API of the tier table command: its route, its response and the exported response
/// interface are what consumers compile and call against, so they stay exactly as released.
/// </summary>
public class and_the_proxy_is_generated : Specification
{
    const string Folder = "generated/Providers/SettingTierModels";

    [Fact]
    void should_preserve_the_published_route() =>
        GeneratedProxies.Read($"{Folder}/SetAIProviderTierModels.ts").ShouldContain("readonly route: string = '/api/a-i/providers/setting-tier-models';");

    [Fact]
    void should_preserve_the_published_response_type() =>
        GeneratedProxies.Read($"{Folder}/SetAIProviderTierModels.ts").ShouldContain("extends Command<ISetAIProviderTierModels, AIProviderTierModelsSet>");

    [Fact]
    void should_preserve_the_published_response_shape() =>
        GeneratedProxies.Read($"{Folder}/AIProviderTierModelsSet.ts").ShouldContain("models!: TierModels;");

    [Fact]
    void should_export_the_response_from_its_folder() =>
        GeneratedProxies.Read($"{Folder}/index.ts").ShouldContain("export * from './AIProviderTierModelsSet';");

    [Fact]
    void should_export_the_folder_from_the_package_root() =>
        GeneratedProxies.Read("index.ts").ShouldContain($"export * from './{Folder}';");

    [Fact]
    void should_return_the_published_event_from_the_handler() =>
        typeof(SetAIProviderTierModels).GetMethod(nameof(SetAIProviderTierModels.Handle))!.ReturnType.ShouldEqual(typeof(AIProviderTierModelsSet));
}
