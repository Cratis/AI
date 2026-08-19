// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Definitions;

/// <summary>
/// Identifies a definition document's exact schema route.
/// </summary>
public enum DefinitionKind
{
    /// <summary>An unsupported definition kind.</summary>
    Unknown = 0,

    /// <summary>A capability catalog.</summary>
    CapabilityCatalog = 1,

    /// <summary>An evaluation catalog.</summary>
    EvaluationCatalog = 2,

    /// <summary>A Factory policy.</summary>
    Policy = 3,

    /// <summary>A Factory profile.</summary>
    Profile = 4,

    /// <summary>A project manifest.</summary>
    ProjectManifest = 5,

    /// <summary>A Factory workflow.</summary>
    Workflow = 6,

    /// <summary>An agent context.</summary>
    AgentContext = 7,

    /// <summary>An artifact descriptor.</summary>
    ArtifactDescriptor = 8,

    /// <summary>Artifact provenance.</summary>
    ArtifactProvenance = 9,

    /// <summary>An artifact receipt.</summary>
    ArtifactReceipt = 10,

    /// <summary>A phase envelope.</summary>
    PhaseEnvelope = 11,

    /// <summary>A run input set.</summary>
    RunInputSet = 12,

    /// <summary>A sanitization attestation.</summary>
    SanitizationAttestation = 13
}
