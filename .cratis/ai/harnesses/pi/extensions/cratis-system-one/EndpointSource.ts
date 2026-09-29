// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Who chose the endpoint. Only the user's own environment may name a non-loopback host or receive a credential. */
export enum EndpointSource {
    Repository = 'repository',
    Environment = 'environment',
}
