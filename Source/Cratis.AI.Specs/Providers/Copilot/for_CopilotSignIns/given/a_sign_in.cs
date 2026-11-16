// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.Copilot.for_CopilotSignIns.given;

public class a_sign_in : SigningIn.given.a_detached_sign_in
{
    protected ICopilotDeviceTokens _tokens;
    protected CopilotDeviceAuthorization _authorization;
    protected CopilotDeviceSignInResult _result;
    protected CopilotSignInStarted? _started;
    protected readonly AIProviderApiKey _credential = new("gho_example");
    CopilotSignIns _signIns;

    void Establish()
    {
        _current = new(_provider, AIProviderType.Copilot, AIProviderApiKey.NotSet);
        _authorization = new("device", "code", "https://example.invalid/verify", 0, DateTimeOffset.UtcNow.AddMinutes(1));
        _result = new(_credential, false, false, string.Empty);
        _tokens = Substitute.For<ICopilotDeviceTokens>();
        _tokens.Begin().Returns(_ => Task.FromResult<CopilotDeviceAuthorization?>(_authorization));
        _tokens.Complete(Arg.Any<CopilotDeviceAuthorization>()).Returns(async _ =>
        {
            await _release.Task;
            return _result;
        });
        _signIns = new(_tokens, _client, _options, _tenants, Substitute.For<ILogger<CopilotSignIns>>());
    }

    protected Task SignIn() => RunDetached(async () => _started = await _signIns.Begin(_provider));
}
