// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Source text and the rollout mode used when collecting hygiene findings. */
export interface HygieneSource {
    file: string;
    content: string;
    authoring: boolean;
}
