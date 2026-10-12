// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export interface StyleDiagnostic {
    code: string;
    name: string;
    severities: string[];
    reserved: boolean;
    retired: boolean;
}
