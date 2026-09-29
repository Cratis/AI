// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

/**
 * Shows text to the user. With a UI it is a notification; without one (print, json, RPC without a UI)
 * `ui.notify` is a no-op, so the text goes to `write`, normally stdout.
 */
export function show(context: Pick<ExtensionContext, 'ui' | 'hasUI'>, write: (text: string) => void, text: string, level: 'info' | 'warning' = 'info'): void {
    if (context.hasUI) context.ui.notify(text, level);
    else write(text);
}
