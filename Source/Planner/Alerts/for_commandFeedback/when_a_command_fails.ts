// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { ICommandResult } from '@cratis/arc/commands';
import { ValidationResult, ValidationResultSeverity } from '@cratis/arc/validation';
import { commandFailureMessage } from '../commandFeedback';

const successfulResult: ICommandResult = {
    correlationId: Guid.empty,
    isSuccess: true,
    isAuthorized: true,
    isValid: true,
    hasExceptions: false,
    validationResults: [],
    exceptionMessages: [],
    authorizationFailureReason: '',
    exceptionStackTrace: '',
};

describe('when a command fails', () => {
    it('should report no problem for a successful result', () => {
        (commandFailureMessage(successfulResult) === undefined).should.be.true;
    });

    it('should report an authorization problem when the command was not authorized', () => {
        const result: ICommandResult = { ...successfulResult, isAuthorized: false };
        commandFailureMessage(result)!.should.equal('You are not authorized to do this - sign in again and retry.');
    });

    it('should report the validation messages when the command is invalid', () => {
        const result: ICommandResult = {
            ...successfulResult,
            isValid: false,
            validationResults: [new ValidationResult(ValidationResultSeverity.Error, 'The alert no longer exists', [], undefined)],
        };
        commandFailureMessage(result)!.should.equal('The alert no longer exists');
    });

    it('should report a generic problem when the command threw an exception', () => {
        const result: ICommandResult = {
            ...successfulResult,
            hasExceptions: true,
            exceptionMessages: ['Something exploded internally, with a stack trace and secrets'],
        };
        commandFailureMessage(result)!.should.equal('Something went wrong. Try again.');
    });

    it('should never leak exception details to the operator', () => {
        const result: ICommandResult = {
            ...successfulResult,
            hasExceptions: true,
            exceptionMessages: ['Something exploded internally, with a stack trace and secrets'],
        };
        commandFailureMessage(result)!.should.not.include('exploded');
    });
});
