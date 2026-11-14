// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.LanguageModels;

/// <summary>
/// An image handed to a vision-capable completion (<see cref="IVisionLanguageModel"/>).
/// </summary>
/// <param name="Data">The raw, encoded image bytes (not base64) - the provider client encodes them for the vendor.</param>
/// <param name="MediaType">The IANA media type of the image: <c>image/png</c>, <c>image/jpeg</c>, <c>image/gif</c> or <c>image/webp</c>.</param>
public record LanguageModelImage(ReadOnlyMemory<byte> Data, string MediaType)
{
    static readonly string[] _supportedMediaTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];

    /// <summary>
    /// Gets the media types a completion accepts.
    /// </summary>
    public static IReadOnlyList<string> SupportedMediaTypes => _supportedMediaTypes;

    /// <summary>
    /// Finds what is wrong with the image, if anything.
    /// </summary>
    /// <returns>The reason the image cannot be sent, or <see langword="null"/> when it is valid.</returns>
    public string? FindProblem()
    {
        if (Data.IsEmpty)
        {
            return "An image given to the language model has no data";
        }

        if (!_supportedMediaTypes.Contains(MediaType, StringComparer.OrdinalIgnoreCase))
        {
            return $"The image media type '{MediaType}' is not supported - use one of {string.Join(", ", _supportedMediaTypes)}";
        }

        return null;
    }
}
