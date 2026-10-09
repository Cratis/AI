// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

const handlers = new Set<() => void>();
const interrupt = () => { for (const handler of handlers) handler(); };

/** One pair of process listeners even at the maximum batch concurrency. */
export function onInterrupt(handler: () => void): () => void {
    if (!handlers.size) {
        process.on('SIGINT', interrupt);
        process.on('SIGTERM', interrupt);
    }
    handlers.add(handler);
    return () => {
        handlers.delete(handler);
        if (!handlers.size) {
            process.removeListener('SIGINT', interrupt);
            process.removeListener('SIGTERM', interrupt);
        }
    };
}
