// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** How Pi says a prompt reached it. Only `Interactive` is a person typing, so only that is judged. */
export enum InputSource {
    Interactive = 'interactive',
    Rpc = 'rpc',
    Extension = 'extension',
}
