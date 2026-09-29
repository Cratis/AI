// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { FileState } from './FileState.ts';

/** A configuration file as found on disk. Resolution never touches the disk itself. */
export type ConfigurationFile =
    | { state: FileState.Missing }
    | { state: FileState.Unreadable }
    /** `readableByOthers` is true when the file's mode lets other users read it. */
    | { state: FileState.Present; text: string; readableByOthers?: boolean };
