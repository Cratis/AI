// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.ComponentModel;
using System.Diagnostics;
using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.DependencyInjection;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Uses the actual Claude Code SDK protocol for subscription tokens, not a fabricated CLI identity
/// on a raw Messages request. Only one child runs at a time within Direct's memory limit; the
/// provider pipeline's deadline also bounds time waiting for that slot.
/// </summary>
/// <param name="process">The child-process boundary.</param>
[Singleton]
public sealed class ClaudeCodeCompletion(IClaudeCodeProcess process) : IClaudeCodeCompletion, IDisposable
{
    readonly SemaphoreSlim _slot = new(1, 1);

    /// <inheritdoc/>
    public async Task<LanguageModelResult> Complete(string prompt, AIProviderApiKey credential, ModelName model, Effort effort, CancellationToken cancellationToken)
    {
        await _slot.WaitAsync(cancellationToken);
        try
        {
            var directory = Directory.CreateTempSubdirectory("direct-completion-").FullName;
            try
            {
                var output = await process.Run(StartInfo(directory, credential, model, effort), prompt, cancellationToken);
                return ClaudeCodeResponse.Read(output, model);
            }
            catch (Win32Exception)
            {
                return LanguageModelResult.Failure("Claude Code could not start. Verify the packaged subscription-completion runtime.");
            }
            finally
            {
                Directory.Delete(directory, recursive: true);
            }
        }
        finally
        {
            _slot.Release();
        }
    }

    /// <inheritdoc/>
    public void Dispose() => _slot.Dispose();

    /// <summary>
    /// Isolates the completion from host credentials, repositories, settings, hooks and tools.
    /// </summary>
    /// <param name="directory">The disposable, empty working directory.</param>
    /// <param name="credential">The subscription token.</param>
    /// <param name="model">The configured model.</param>
    /// <param name="effort">The requested reasoning effort.</param>
    /// <returns>The isolated process configuration.</returns>
    internal static ProcessStartInfo StartInfo(string directory, AIProviderApiKey credential, ModelName model, Effort effort)
    {
        var info = new ProcessStartInfo("claude")
        {
            WorkingDirectory = directory,
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };
        info.Environment.Clear();
        info.Environment["PATH"] = Environment.GetEnvironmentVariable("PATH");
        info.Environment["HOME"] = directory;
        info.Environment["CLAUDE_CONFIG_DIR"] = Path.Combine(directory, ".claude");
        info.Environment["CLAUDE_CODE_OAUTH_TOKEN"] = Cratis.AI.Providers.Anthropic.AnthropicCredential.Normalize(credential.Value).Value;
        info.Environment["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = "1";
        string[] arguments = ["-p", "--output-format", "json", "--model", model.Value,
            "--effort", effort switch { Effort.Low => "low", Effort.Medium => "medium", Effort.ExtraHigh => "xhigh", _ => "high" },
            "--max-turns", "1", "--tools", string.Empty, "--strict-mcp-config", "--mcp-config", "{\"mcpServers\":{}}",
            "--disable-slash-commands", "--no-session-persistence", "--setting-sources", string.Empty,
            "--settings", "{\"disableAllHooks\":true}"];
        foreach (var argument in arguments) info.ArgumentList.Add(argument);

        return info;
    }
}
