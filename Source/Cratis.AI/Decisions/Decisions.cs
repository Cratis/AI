// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using Cratis.AI.Providers;
using Cratis.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Decisions;

/// <summary>
/// Represents an implementation of <see cref="IDecisions"/>.
/// </summary>
/// <param name="resolver">Resolves which provider and model decisions are made through.</param>
/// <param name="clients">The convention-discovered vendor clients.</param>
/// <param name="telemetry">The <see cref="IDecisionTelemetry"/>.</param>
/// <param name="options">The <see cref="DecisionOptions"/>.</param>
/// <param name="logger">The logger.</param>
public class Decisions(
    IDecisionProviderResolver resolver,
    IInstancesOf<IDecisionProviderClient> clients,
    IDecisionTelemetry telemetry,
    IOptions<DecisionOptions> options,
    ILogger<Decisions> logger) : IDecisions
{
    /// <inheritdoc/>
    public async Task<DecisionResult> Decide(DecisionRequest request, CancellationToken cancellationToken = default)
    {
        var results = await Decide([request], cancellationToken);

        return results[0];
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<DecisionResult>> Decide(IReadOnlyList<DecisionRequest> requests, CancellationToken cancellationToken = default)
    {
        if (requests.Count == 0)
        {
            return [];
        }

        if (requests.Count > options.Value.MaxBatchSize)
        {
            throw new DecisionRequestIsNotAnswerable($"{requests.Count} requests exceeds the batch limit of {options.Value.MaxBatchSize}");
        }

        foreach (var request in requests)
        {
            AssertAnswerable(request);
        }

        var selection = await resolver.Resolve(cancellationToken);
        if (selection is null)
        {
            logger.NoProviderConfigured();
            throw new DecisionProviderNotConfigured();
        }

        var type = selection.Provider.Type;
        if (!AIProviderCapabilities.Supports(type, AIProviderCapability.Decision))
        {
            throw new ProviderDoesNotSupportDecisions(type);
        }

        var client = clients.FirstOrDefault(_ => _.Type == type) ?? throw new ProviderDoesNotSupportDecisions(type);

        using var activity = telemetry.Start(requests.Sum(_ => _.Choices.Count), requests[0].Context);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(options.Value.Timeout);

        logger.Deciding(requests[0].Choices.Count, type, selection.Model.Value);

        var started = Stopwatch.GetTimestamp();
        try
        {
            var distributions = await client.Decide(requests, selection.Provider, selection.Model, timeout.Token);
            var elapsed = Stopwatch.GetElapsedTime(started);

            var results = new List<DecisionResult>(requests.Count);
            for (var index = 0; index < requests.Count; index++)
            {
                results.Add(ResultFor(requests[index], distributions[index], selection, elapsed, type));
            }

            telemetry.Decided(activity, type, results[0]);

            return results;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.RequestTimedOut(type, options.Value.Timeout);
            telemetry.Failed(activity, type, selection.Model, Stopwatch.GetElapsedTime(started), "timed out");
            throw;
        }
        catch (Exception ex)
        {
            telemetry.Failed(activity, type, selection.Model, Stopwatch.GetElapsedTime(started), ex.Message);
            throw;
        }
    }

    DecisionResult ResultFor(
        DecisionRequest request,
        IReadOnlyList<DecisionOutcome> distribution,
        DecisionProviderSelection selection,
        TimeSpan elapsed,
        AIProviderType type)
    {
        var returned = distribution.ToDictionary(_ => _.Choice, _ => _.Probability);
        var missing = request.Choices.Where(choice => !returned.ContainsKey(choice)).ToList();
        if (missing.Count > 0)
        {
            logger.ChoiceCountMismatch(type, distribution.Count, request.Choices.Count);
            throw new DecisionChoicesNotCovered(missing);
        }

        // Rebuilt in the order the caller supplied the choices, not the order the provider answered
        // in, so that DecisionResult.From's stable sort breaks ties the way the workflow listed them.
        var outcomes = request.Choices.Select(choice => new DecisionOutcome(choice, returned[choice])).ToList();

        return DecisionResult.From(outcomes, selection.Model, selection.Provider.Id, elapsed);
    }

    void AssertAnswerable(DecisionRequest request)
    {
        if (request.Context.IsEmpty)
        {
            throw new DecisionRequestIsNotAnswerable("there is no context to weigh the choices against");
        }

        if (request.Choices.Count == 0)
        {
            throw new DecisionRequestIsNotAnswerable("there are no choices to weigh");
        }

        if (request.Choices.Count > options.Value.MaxChoices)
        {
            throw new DecisionRequestIsNotAnswerable($"{request.Choices.Count} choices exceeds the limit of {options.Value.MaxChoices}");
        }

        if (request.Choices.Distinct().Count() != request.Choices.Count)
        {
            throw new DecisionRequestIsNotAnswerable("the choices are not distinct");
        }
    }
}
