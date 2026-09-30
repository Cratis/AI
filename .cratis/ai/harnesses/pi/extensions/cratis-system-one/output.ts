// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { NotifyLevel } from './NotifyLevel.ts';

/**
 * Shows text to the user. With a UI it is a notification; without one (print and json modes) `ui.notify`
 * is a no-op, so the text goes to `write`, normally the terminal: stderr, because stdout carries the model's
 * output or the JSON stream there.
 */
export function show(context: Pick<ExtensionContext, 'ui' | 'hasUI'>, write: (text: string) => void, text: string, level: NotifyLevel = NotifyLevel.Info): void {
    if (context.hasUI) context.ui.notify(text, level);
    else write(text);
}
