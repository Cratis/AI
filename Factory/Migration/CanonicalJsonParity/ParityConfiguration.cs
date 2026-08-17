// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.CanonicalJsonParity;

sealed record ParityConfiguration(string RepositoryRoot, string PythonExecutable)
{
    public static ParityConfiguration? TryParse(string[] arguments)
    {
        string? repositoryRoot = null;
        var pythonExecutable = "python3";

        for (var index = 0; index < arguments.Length; index += 2)
        {
            if (index + 1 >= arguments.Length)
            {
                return null;
            }

            switch (arguments[index])
            {
                case "--repository-root":
                    repositoryRoot = arguments[index + 1];
                    break;
                case "--python":
                    pythonExecutable = arguments[index + 1];
                    break;
                default:
                    return null;
            }
        }

        if (string.IsNullOrWhiteSpace(repositoryRoot) || string.IsNullOrWhiteSpace(pythonExecutable))
        {
            return null;
        }

        try
        {
            return new(Path.GetFullPath(repositoryRoot), pythonExecutable);
        }
        catch (Exception error) when (error is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return null;
        }
    }
}
