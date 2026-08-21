// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export function compareOrdinal(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

export function sortedOrdinal(values) {
    return [...values].sort(compareOrdinal);
}
