// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ICommandResult } from '@cratis/arc/commands';

/**
 * Gets the problem to report for a failed command, based on the granular `CommandResult` flags -
 * checked in the order authorization, then validation, then exceptions. Never surfaces
 * `exceptionMessages`/a stack trace to the user.
 * Accepts any response type since only the granular result flags are inspected.
 * @param result The result of executing the command.
 * @returns The problem to report, or `undefined` when the command succeeded.
 */
export const commandFailureMessage = (result: ICommandResult<unknown>): string | undefined => {
    if (!result.isAuthorized) {
        return 'You are not authorized to do this - sign in again and retry.';
    }

    if (!result.isValid) {
        return result.validationResults.map((validationResult) => validationResult.message).join(' ');
    }

    if (result.hasExceptions) {
        return 'Something went wrong. Try again.';
    }

    return undefined;
};
