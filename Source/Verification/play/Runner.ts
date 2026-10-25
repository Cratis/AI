// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Invocation } from './Invocation.ts';

export type Runner = (tool: string, arguments_: string[], directory: string) => Promise<Invocation>;
