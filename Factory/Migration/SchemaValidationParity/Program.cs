// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Factory.SchemaValidationParity;

var configuration = ParityConfiguration.TryParse(args);
var summary = configuration is null
    ? ParitySummary.InvocationFailure()
    : ParityRunner.Run(configuration);

Console.WriteLine(JsonSerializer.Serialize(summary, ParityJson.Options));
return summary.ExitCode;
