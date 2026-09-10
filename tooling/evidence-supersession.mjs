// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// The evidence catalog is append-only: an observation is never edited or deleted, so renewing one means
// appending a new observation whose `supersedes` names the observation it replaces. The replaced observation
// stays in the catalog as history, which means its own `expiresOn` keeps moving into the past forever. Expiry
// therefore has to be read through the supersession chain rather than record by record: once a live replacement
// covers an observation, that observation's expiry stops gating anything, exactly as `assertionsForBinding` in
// tooling/support-validation.mjs already demotes an observation that an active observation supersedes.

function isLive(record, asOf) {
    return record.verifiedOn <= asOf && asOf <= record.expiresOn;
}

// Ids of the evidence records that a live replacement covers, directly or through a chain of renewals, and whose
// own expiry is consequently historical. Records without a replacement, and records whose whole replacement chain
// has itself expired or is not yet in force, are absent so that they keep gating.
export function supersededEvidenceIds(records, asOf) {
    const recordsById = new Map(records.map((record) => [record.id, record]));
    const replacementIdsById = new Map();
    for (const record of records) {
        for (const supersededId of record.supersedes ?? []) {
            replacementIdsById.set(supersededId, [
                ...(replacementIdsById.get(supersededId) ?? []),
                record.id,
            ]);
        }
    }
    function coveredByLiveReplacement(id, visited) {
        for (const replacementId of replacementIdsById.get(id) ?? []) {
            if (visited.has(replacementId)) continue;
            visited.add(replacementId);
            const replacement = recordsById.get(replacementId);
            if (!replacement) continue;
            if (isLive(replacement, asOf)) return true;
            if (coveredByLiveReplacement(replacementId, visited)) return true;
        }
        return false;
    }
    return new Set(
        [...replacementIdsById.keys()].filter((id) =>
            coveredByLiveReplacement(id, new Set([id])),
        ),
    );
}
