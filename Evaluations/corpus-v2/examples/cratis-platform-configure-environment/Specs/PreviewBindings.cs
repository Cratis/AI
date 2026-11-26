using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;
using Xunit;

public class PreviewBindings
{
    const string Allowed = "http://127.0.0.1:4107/preview";

    static string Inspect(string prefix)
    {
        using var settings = new ConfigurationManager();
        settings.AddEnvironmentVariables(prefix);
        if (settings["Preview:Endpoint"] != Allowed) throw new InvalidOperationException("Invalid Preview:Endpoint");
        if (string.IsNullOrWhiteSpace(settings["Cratis:Chronicle:ConnectionString"])) throw new InvalidOperationException("Missing Chronicle connection string");
        return $"Preview target: {Allowed}";
    }

    [Fact]
    public void EffectiveBindingsFailClosedWithoutPrintingTheSecret()
    {
        var prefix = $"PREVIEW_FIXTURE_{Guid.NewGuid():N}_";
        var endpoint = prefix + "Preview__Endpoint";
        var credential = prefix + "Cratis__Chronicle__ConnectionString";
        var marker = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        try
        {
            Environment.SetEnvironmentVariable(endpoint, Allowed);
            Assert.Equal("Missing Chronicle connection string", Assert.Throws<InvalidOperationException>(() => Inspect(prefix)).Message);
            Environment.SetEnvironmentVariable(credential, marker);
            var success = Inspect(prefix);
            Assert.Equal($"Preview target: {Allowed}", success);
            Assert.DoesNotContain(marker, success);
            Environment.SetEnvironmentVariable(endpoint, "https://other.invalid/preview?credential=" + marker);
            var error = Assert.Throws<InvalidOperationException>(() => Inspect(prefix));
            Assert.Equal("Invalid Preview:Endpoint", error.Message);
            Assert.DoesNotContain(marker, error.Message);
        }
        finally
        {
            Environment.SetEnvironmentVariable(endpoint, null);
            Environment.SetEnvironmentVariable(credential, null);
        }
    }
}
