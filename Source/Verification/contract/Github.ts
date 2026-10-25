// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Injectable command boundary; specs never contact GitHub. */
export type Github = (arguments_: string[], input?: string) => Promise<string>;
