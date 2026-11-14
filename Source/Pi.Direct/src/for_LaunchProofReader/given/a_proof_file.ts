// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readLaunchProof } from '../../LaunchProofReader.ts';
import { FakeFileSystem, sentinelProof } from '../../for_Support/given/Fakes.ts';

/** A valid owner-only proof file in an owner-only folder outside the working tree. */
export class a_proof_file {
    readonly fileSystem = new FakeFileSystem();
    readonly path = '/state/launches/abc/launch.proof';
    readonly folder = '/state/launches/abc';
    readonly proof = sentinelProof;
    uid = 501;
    platform = 'darwin';
    cwd = '/work/tree';

    constructor() {
        this.fileSystem.add(this.folder, { isFile: false, isDirectory: true, mode: 0o040700 });
        this.fileSystem.add(this.path, {}, this.proof);
    }

    replaceFile(info: object, content = this.proof): void { this.fileSystem.add(this.path, info, content); }

    replaceFolder(info: object): void { this.fileSystem.add(this.folder, { isFile: false, isDirectory: true, mode: 0o040700, ...info }); }

    read(path = this.path): Buffer {
        return readLaunchProof(path, { fileSystem: this.fileSystem, uid: this.uid, platform: this.platform, cwd: this.cwd });
    }
}
