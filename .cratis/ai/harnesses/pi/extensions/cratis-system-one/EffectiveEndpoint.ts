// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EndpointCheck } from './EndpointCheck.ts';

/** The endpoint a user's file resolves to once `SYSTEMONE_ENDPOINT` is taken into account. */
export interface EffectiveEndpoint {
    checked: EndpointCheck;
    fromEnvironment: boolean;
}
