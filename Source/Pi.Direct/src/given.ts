// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Hands the suite a parameterless specification context that is rebuilt before every spec,
 * so no state leaks from one spec to the next. The suite's own `beforeEach` runs after the rebuild.
 */
export function given<TContext extends object>(contextType: new () => TContext, suite: (context: TContext) => void): () => void {
    return () => {
        let current = new contextType();
        const context = new Proxy({} as TContext, {
            get: (_, key) => {
                const value = Reflect.get(current, key);
                return typeof value === 'function' ? value.bind(current) : value;
            },
            set: (_, key, value) => Reflect.set(current, key, value)
        });
        beforeEach(() => { current = new contextType(); });
        suite(context);
    };
}
