using System.Text.Json;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Observation;
using Xunit;

public class ObserverCapture
{
    static string FirstGap(JsonElement capture, JsonElement sample)
    {
        if (!capture.GetProperty("accepted").GetBoolean()) return "Command refused";
        var position = capture.GetProperty("appended").GetUInt64();
        var checkpoint = sample.GetProperty("checkpoint").GetUInt64();
        var observer = new ObserverInformation("Author", EventSequenceId.Log, ObserverType.Projection,
            ObserverRunningState.Active, checkpoint, checkpoint + 1, checkpoint + 1);
        if (observer.LastHandledEventSequenceNumber.Value < position) return "Observer behind";
        var key = capture.GetProperty("source").GetString();
        return sample.GetProperty("rows").EnumerateArray().Any(row => row.GetProperty("id").GetString() == key)
            ? "Row returned; inspect delivery" : "Gap between checkpoint and query";
    }

    [Fact]
    public void LocatesTheFirstBehindStageBeforeAttributingTheMissingRowToRendering()
    {
        using var doc = JsonDocument.Parse(File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "capture.json")));
        var capture = doc.RootElement;
        Assert.Equal("fixture-request", capture.GetProperty("trace").GetString());
        Assert.Equal("isolated", capture.GetProperty("namespace").GetString());
        Assert.True(capture.GetProperty("accepted").GetBoolean());
        var append = capture.GetProperty("appended").GetInt32();
        var samples = capture.GetProperty("samples");
        Assert.Equal("Observer behind", FirstGap(capture, samples[0]));
        Assert.Equal("Row returned; inspect delivery", FirstGap(capture, samples[1]));
        Assert.True(samples[0].GetProperty("checkpoint").GetInt32() < append);
        Assert.Empty(samples[0].GetProperty("rows").EnumerateArray());
        Assert.Equal(append, samples[1].GetProperty("checkpoint").GetInt32());
        Assert.True(samples[1].GetProperty("elapsedMs").GetInt32() > samples[0].GetProperty("elapsedMs").GetInt32());
        var row = Assert.Single(samples[1].GetProperty("rows").EnumerateArray());
        Assert.Equal(capture.GetProperty("source").GetString(), row.GetProperty("id").GetString());
        Assert.Equal("Aster", row.GetProperty("name").GetString());
    }
}
