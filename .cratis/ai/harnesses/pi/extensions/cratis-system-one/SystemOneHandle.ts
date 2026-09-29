// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export interface SystemOneHandle {
    /** Resolves when every background request has finished. Only specs need this. */
    settled(): Promise<void>;
}
