// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.given;

public class exec_stream : MemoryStream
{
    readonly MemoryStream _output = new([1, 0, 0, 0, 0, 0, 0, 1, 65]);

    public bool Drained { get; private set; }

    public bool Disposed { get; private set; }

    public Exception WriteFailure { get; set; }

    public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
    {
        var read = await _output.ReadAsync(buffer.AsMemory(offset, count), cancellationToken);
        Drained = read == 0;
        return read;
    }

    public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
        WriteFailure is not null ? Task.FromException(WriteFailure) : base.WriteAsync(buffer, offset, count, cancellationToken);

    protected override void Dispose(bool disposing)
    {
        Disposed = true;
        _output.Dispose();
        base.Dispose(disposing);
    }
}
