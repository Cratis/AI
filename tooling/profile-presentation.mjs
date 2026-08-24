// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

const wordLabels = new Map([
    ["ai", "AI"],
    ["arc", "Arc"],
    ["cli", "CLI"],
    ["components", "Components"],
    ["compliance", "Compliance"],
    ["dotnet", ".NET"],
    ["ef", "EF"],
    ["elixir", "Elixir"],
    ["fundamentals", "Fundamentals"],
    ["java", "Java"],
    ["kotlin", "Kotlin"],
    ["lens", "Lens"],
    ["mcp", "MCP"],
    ["modeling", "Modeling"],
    ["python", "Python"],
    ["react", "React"],
    ["screenplay", "Screenplay"],
    ["specifications", "Specifications"],
    ["stage", "Stage"],
    ["stagehand", "Stagehand"],
    ["studio", "Studio"],
    ["typescript", "TypeScript"],
    ["web", "Web"],
    ["workbench", "Workbench"],
    ["workflows", "Workflows"],
]);

const productLabels = new Map([
    ["ai", "Cratis AI"],
    ["application", "Cratis applications"],
    ["arc", "Cratis Arc"],
    ["arc-react", "Cratis Arc React"],
    ["chronicle", "Cratis Chronicle"],
    ["chronicle-mcp", "Chronicle MCP"],
    ["cli", "the Cratis CLI"],
    ["components", "Cratis Components"],
    ["documentation", "Cratis documentation"],
    ["entity-framework-core", "Entity Framework Core"],
    ["fundamentals", "Cratis Fundamentals"],
    ["lens", "Cratis Lens"],
    ["screenplay", "Cratis Screenplay"],
    ["specifications", "Cratis Specifications"],
    ["stage", "Cratis Stage"],
    ["stagehand", "Cratis Stagehand"],
    ["studio", "Cratis Studio"],
    ["workflows", "Cratis Workflows"],
]);

const displayNameOverrides = new Map([
    ["public-application", "Cratis Application Development"],
    ["public-application-arc-chronicle", "Cratis Arc + Chronicle Application"],
    ["public-application-arc-only", "Cratis Arc Application"],
    [
        "public-application-chronicle-dotnet",
        "Cratis Chronicle .NET Application",
    ],
    ["public-application-react", "Cratis React Application"],
    ["public-arc-ef-core", "Cratis Arc with EF Core"],
    ["public-chronicle-client-dotnet", "Cratis Chronicle .NET Client"],
    ["public-chronicle-client-elixir", "Cratis Chronicle Elixir Client"],
    ["public-chronicle-client-java", "Cratis Chronicle Java Client"],
    ["public-chronicle-client-kotlin", "Cratis Chronicle Kotlin Client"],
    ["public-chronicle-client-python", "Cratis Chronicle Python Client"],
    [
        "public-chronicle-client-typescript",
        "Cratis Chronicle TypeScript Client",
    ],
    ["public-modeling-screenplay-stage", "Cratis Screenplay → Stage"],
]);

const descriptionOverrides = new Map([
    [
        "public-fundamentals",
        "Strongly typed Cratis Fundamentals concepts and Chronicle event-source identities for C# projects.",
    ],
    [
        "public-application",
        "End-to-end guidance for building Cratis applications with Arc, Chronicle, React, Components, and Specifications.",
    ],
    [
        "engineering-base",
        "Public-safe shared engineering conventions for contributors across Cratis repositories.",
    ],
    [
        "engineering-documentation",
        "Public-safe documentation authoring guidance for maintainers working across Cratis product repositories.",
    ],
]);

function joinNatural(values) {
    if (values.length === 0) return "Cratis";
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function wordsFromId(profileId) {
    const words = profileId
        .replace(/^(?:public|engineering)-/, "")
        .split("-")
        .filter((word) => word !== "cratis")
        .map(
            (word) =>
                wordLabels.get(word) ??
                `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`,
        );
    return words;
}

export function profileDisplayName(profile, audience) {
    const override = displayNameOverrides.get(profile.id);
    if (override) return override;
    const words = wordsFromId(profile.id);
    if (profile.id === "engineering-base") return "Cratis Maintainer Base";
    if (audience === "cratis-engineering")
        return `Cratis ${words.join(" ")} Maintainer`;
    return `Cratis ${words.join(" ")}`;
}

export function profileDescription(profile, audience) {
    const override = descriptionOverrides.get(profile.id);
    if (override) return override;
    const products = joinNatural(
        (profile.products ?? []).map(
            (product) => productLabels.get(product) ?? product,
        ),
    );
    if (audience === "cratis-engineering")
        return `Public-safe contributor guidance for maintainers working on ${products}. Private repository details remain local.`;
    if (profile.state === "planned-composition")
        return `Combined AI guidance for developers using ${products} in one solution.`;
    return `AI guidance for developers building with ${products}.`;
}

export function profileIntendedFor(profile, audience) {
    const products = joinNatural(
        (profile.products ?? []).map(
            (product) => productLabels.get(product) ?? product,
        ),
    );
    if (audience === "cratis-engineering") {
        const repositoryKinds = joinNatural(
            (profile.repositoryKinds ?? []).map(
                (kind) => `${kind} ${kind === "corpus" ? "repositories" : "projects"}`,
            ),
        );
        return `Cratis maintainers contributing to ${products} in ${repositoryKinds}.`;
    }
    return `Developers who use ${products}.`;
}

export function profileMaterialization(profile) {
    if (profile.state === "approved") return "installable-package";
    if (profile.state === "planned-composition") return "composition";
    if ((profile.availableTargets?.length ?? 0) > 0) return "candidate-package";
    return "catalog-only";
}

export function presentProfile(profile, audience) {
    return {
        id: profile.id,
        displayName: profileDisplayName(profile, audience),
        description: profileDescription(profile, audience),
        intendedFor: profileIntendedFor(profile, audience),
        audience,
        packageName: profile.packageName,
        state: profile.state,
        installable: profile.state === "approved",
        materialization: profileMaterialization(profile),
        products: [...(profile.products ?? [])],
        languages: [...(profile.languages ?? [])],
        repositoryKinds: [...(profile.repositoryKinds ?? [])],
        composes: [...(profile.composes ?? [])],
        directTargetIds: [...(profile.availableTargets ?? [])],
    };
}
