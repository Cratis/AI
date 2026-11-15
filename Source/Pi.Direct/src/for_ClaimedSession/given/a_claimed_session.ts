// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ClaimedSession } from '../../ClaimedSession.ts';
import { a_launch } from '../../for_Support/given/a_launch.ts';

/** A launch that already claimed; the session is ready to heartbeat and finish. */
export class a_claimed_session extends a_launch {
    session!: ClaimedSession;

    async claim(): Promise<void> { this.session = await this.launch(); }
}
