// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Writes the folder source form of the published screens corpus to a folder and prints the package version it
// came from. screens-smoke.sh copies this file next to a pinned version line and runs it outside the repository,
// so it consumes the corpus a consumer receives and none of this repository's build settings.
#:package Cratis.Screenplay.CanonicalCorpus@CORPUS_VERSION
using System.Reflection;
using Cratis.Screenplay.CanonicalCorpus;

if (args.Length != 1)
{
    Console.Error.WriteLine("usage: materialize-corpus <destination>");
    return 2;
}

var form = ScreenCompositionCorpus.V1.SourceForms.Single(candidate => candidate.Name == "folder");
var documents = form.Documents.ToArray();
if (documents.Length == 0)
{
    Console.Error.WriteLine("the published folder source form has no documents");
    return 2;
}

var destination = Path.GetFullPath(args[0]);
foreach (var document in documents)
{
    var path = Path.GetFullPath(Path.Combine(destination, document.DisplayPath));
    if (!path.StartsWith(destination + Path.DirectorySeparatorChar, StringComparison.Ordinal))
    {
        Console.Error.WriteLine($"refusing a document path outside the destination: {document.DisplayPath}");
        return 2;
    }

    Directory.CreateDirectory(Path.GetDirectoryName(path)!);
    File.WriteAllText(path, document.Text);
}

var version = typeof(ScreenCompositionCorpus).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "unknown";
Console.WriteLine($"{documents.Length} documents from Cratis.Screenplay.CanonicalCorpus {version.Split('+')[0]}");
return 0;
