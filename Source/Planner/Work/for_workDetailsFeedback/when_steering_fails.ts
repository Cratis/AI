// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { steeringFailureMessage } from '../workDetailsFeedback';

describe('when steering fails', () => {
    it('should report an authentication problem for a 401 response', () => {
        steeringFailureMessage(401).should.equal('Your session has expired - sign in again to steer the running session.');
    });

    it('should report a generic problem for another non-ok status', () => {
        steeringFailureMessage(500).should.equal('Sending failed - the running session did not receive your message.');
    });

    it('should report a generic problem for a network failure', () => {
        steeringFailureMessage(undefined).should.equal('Sending failed - the running session did not receive your message.');
    });
});
