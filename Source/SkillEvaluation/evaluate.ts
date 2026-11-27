// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

const [command, ...args] = process.argv.slice(2);
if (command === 'suite' || command === 'suite-report') {
    const { suiteMain, suiteReport } = await import('./suite-runner.ts');
    try {
        if (command === 'suite') await suiteMain(args);
        else {
            if (args.length !== 1) throw new Error('Usage: evaluate suite-report <run-directory>');
            await suiteReport(args[0]);
        }
    } catch (error) { console.error(String(error)); process.exitCode = 1; }
} else {
    // Keep the original answer/trigger/LLM-grade command path and its read-only tools unchanged.
    await import('./cli.ts');
}
