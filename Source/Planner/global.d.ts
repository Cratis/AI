// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference types="vitest/globals" />
/// <reference types="chai" />
/// <reference types="chai/register-should" />
/// <reference types="sinon-chai" />

declare module '*.css';
declare module '*.svg' {
    const content: string;
    export default content;
}
