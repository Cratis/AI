// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** `SYSTEMONE_ENDPOINT` sending data somewhere other than the endpoint the user chose in setup. */
export interface EndpointOverride {
    chosen: string;
    effective: string;
}
