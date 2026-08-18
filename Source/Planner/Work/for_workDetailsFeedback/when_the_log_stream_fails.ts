// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { logStreamFailureMessage } from '../workDetailsFeedback';

describe('when the log stream fails', () => {
    it('should report a problem when the connection was refused (closed)', () => {
        logStreamFailureMessage(2)!.should.equal('The console log stream was refused - sign in again to keep watching this work.');
    });

    it('should report no problem when the stream is merely connecting or has ended normally', () => {
        (logStreamFailureMessage(0) === undefined).should.be.true;
    });
});
