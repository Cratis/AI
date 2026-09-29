// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Which credential the user agreed to in `/system-one setup`, as stored in the user file. An environment
 * key is attached to a non-TypeSafe origin only when it is the one agreed to here.
 */
export enum AgreedKey {
    None = 'none',
    Typed = 'typed',
    SystemOneEnvironment = 'SYSTEMONE_API_KEY',
    TypeSafeEnvironment = 'TYPESAFE_API_KEY',
}
