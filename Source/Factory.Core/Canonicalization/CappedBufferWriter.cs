// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Text;

namespace Cratis.Factory.Canonicalization;

sealed class CappedBufferWriter(int maximumLength) : IBufferWriter<byte>
{
    byte[] _buffer = new byte[Math.Min(256, maximumLength)];
    int _written;

    public void Advance(int count)
    {
        if (count < 0 || count > _buffer.Length - _written)
        {
            throw new InvalidCanonicalJson(new(CanonicalJsonFailureCode.CanonicalOutputTooLarge, maximumLength));
        }

        _written += count;
    }

    public Memory<byte> GetMemory(int sizeHint = 0)
    {
        EnsureCapacity(sizeHint);
        return _buffer.AsMemory(_written);
    }

    public Span<byte> GetSpan(int sizeHint = 0)
    {
        EnsureCapacity(sizeHint);
        return _buffer.AsSpan(_written);
    }

    public void Write(ReadOnlySpan<byte> value)
    {
        var destination = GetSpan(value.Length);
        value.CopyTo(destination);
        Advance(value.Length);
    }

    public void WriteAscii(string value)
    {
        var destination = GetSpan(value.Length);
        var written = Encoding.ASCII.GetBytes(value, destination);
        Advance(written);
    }

    public void WriteByte(byte value)
    {
        GetSpan(1)[0] = value;
        Advance(1);
    }

    public byte[] ToArray() => _buffer.AsSpan(0, _written).ToArray();

    void EnsureCapacity(int sizeHint)
    {
        sizeHint = Math.Max(sizeHint, 1);
        var requiredLength = (long)_written + sizeHint;
        if (requiredLength > maximumLength)
        {
            throw new InvalidCanonicalJson(new(CanonicalJsonFailureCode.CanonicalOutputTooLarge, maximumLength));
        }

        if (requiredLength <= _buffer.Length)
        {
            return;
        }

        var expandedLength = Math.Min(maximumLength, Math.Max((long)_buffer.Length * 2, requiredLength));
        Array.Resize(ref _buffer, (int)expandedLength);
    }
}
