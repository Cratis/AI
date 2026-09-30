// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Where the credential sent with requests comes from. Setup names it before the user confirms. */
export enum KeySource {
    SystemOneEnvironment = 'your SYSTEMONE_API_KEY from the environment',
    TypeSafeEnvironment = 'your TYPESAFE_API_KEY from the environment',
    Entered = 'the key you entered',
    None = 'no credential',
}
