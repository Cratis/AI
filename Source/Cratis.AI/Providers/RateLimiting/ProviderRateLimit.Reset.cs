// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;
using System.Text.RegularExpressions;

namespace Cratis.AI.Providers.RateLimiting;

/// <summary>
/// Reads when a provider's own usage limit lifts out of what the provider said when it turned work
/// away.
/// </summary>
public static partial class ProviderRateLimit
{
    const int MatchTimeoutMilliseconds = 1000;

    static readonly string[] _months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

    /// <summary>
    /// Reads the moment a usage limit lifts, when the failure says so.
    /// </summary>
    /// <remarks>
    /// <para>
    /// A subscription's allowance resets on a schedule the vendor knows and usually states: Claude
    /// Code says "You've hit your weekly limit · resets Oct 9, 2am (UTC)", and its older form appends
    /// the reset as Unix epoch seconds ("Claude AI usage limit reached|1760000000"). Parking a
    /// provider for a flat hour when its weekly allowance resets days later costs a wasted worker
    /// session every hour until then, so the stated reset is worth reading whenever it is there.
    /// </para>
    /// <para>
    /// Recognized forms:
    /// <list type="bullet">
    /// <item><c>|1760000000</c> - Unix epoch seconds after a pipe.</item>
    /// <item><c>resets at 2026-10-09T02:00:00Z</c> - an ISO 8601 timestamp; one without an offset is read as UTC.</item>
    /// <item><c>resets Oct 9, 2am (UTC)</c> - a date without a year is the next occurrence at or after <paramref name="now"/>.</item>
    /// <item><c>resets 3pm (UTC)</c>, <c>resets 10:30pm (Europe/Oslo)</c> - a time alone is the next occurrence after <paramref name="now"/>.</item>
    /// </list>
    /// A time zone is resolved through <see cref="TimeZoneInfo"/>; one it does not know yields
    /// <see langword="null"/> rather than a guess, since a wrong reset is worse than none - the
    /// caller then falls back to its own cooldown. A time without a zone is read as UTC.
    /// </para>
    /// </remarks>
    /// <param name="reason">What the provider or worker reported.</param>
    /// <param name="now">The current time, which a reset without a full date is resolved against.</param>
    /// <returns>When the limit lifts, or <see langword="null"/> when the text does not say in a form this understands.</returns>
    public static DateTimeOffset? ResetIndicatedBy(string reason, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            return null;
        }

        try
        {
            return Read(reason, now);
        }
        catch (RegexMatchTimeoutException)
        {
            // Pathological text is not worth a stalled failure path - no reset read means the
            // caller's own cooldown applies, exactly as if the text had stated none.
            return null;
        }
    }

    static DateTimeOffset? Read(string reason, DateTimeOffset now)
    {
        var epoch = EpochSuffix().Match(reason);
        if (epoch.Success && long.TryParse(epoch.Groups["seconds"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds))
        {
            return DateTimeOffset.FromUnixTimeSeconds(seconds);
        }

        var iso = IsoReset().Match(reason);
        if (iso.Success)
        {
            return DateTimeOffset.TryParse(iso.Groups["timestamp"].Value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var timestamp)
                ? timestamp
                : null;
        }

        var wallClock = WallClockReset().Match(reason);
        return wallClock.Success ? FromWallClock(wallClock, now) : null;
    }

    static DateTimeOffset? FromWallClock(Match match, DateTimeOffset now)
    {
        var zone = ZoneNamed(match.Groups["zone"].Success ? match.Groups["zone"].Value.Trim() : "UTC");
        if (zone is null)
        {
            return null;
        }

        var hour = int.Parse(match.Groups["hour"].Value, CultureInfo.InvariantCulture);
        var minute = match.Groups["minute"].Success ? int.Parse(match.Groups["minute"].Value, CultureInfo.InvariantCulture) : 0;
        if (hour is < 1 or > 12 || minute > 59)
        {
            return null;
        }

        hour = (hour % 12) + (match.Groups["meridiem"].Value.Equals("pm", StringComparison.OrdinalIgnoreCase) ? 12 : 0);
        var nowInZone = TimeZoneInfo.ConvertTime(now, zone);

        if (!match.Groups["month"].Success)
        {
            var today = InZone(zone, nowInZone.Year, nowInZone.Month, nowInZone.Day, hour, minute);
            return today is null ? null : today > now ? today : InZone(zone, today.Value.AddDays(1), hour, minute);
        }

        var month = Array.IndexOf(_months, match.Groups["month"].Value[..3].ToLowerInvariant()) + 1;
        var day = int.Parse(match.Groups["day"].Value, CultureInfo.InvariantCulture);
        if (match.Groups["year"].Success)
        {
            return InZone(zone, int.Parse(match.Groups["year"].Value, CultureInfo.InvariantCulture), month, day, hour, minute);
        }

        var thisYear = InZone(zone, nowInZone.Year, month, day, hour, minute);
        return thisYear is not null && thisYear >= now ? thisYear : InZone(zone, nowInZone.Year + 1, month, day, hour, minute);
    }

    static DateTimeOffset? InZone(TimeZoneInfo zone, DateTimeOffset dayInZone, int hour, int minute)
    {
        var local = TimeZoneInfo.ConvertTime(dayInZone, zone);
        return InZone(zone, local.Year, local.Month, local.Day, hour, minute);
    }

    static DateTimeOffset? InZone(TimeZoneInfo zone, int year, int month, int day, int hour, int minute)
    {
        if (month is < 1 or > 12 || day < 1 || day > DateTime.DaysInMonth(year, month))
        {
            return null;
        }

        var local = new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Unspecified);
        return new DateTimeOffset(local, zone.GetUtcOffset(local));
    }

    static TimeZoneInfo? ZoneNamed(string name)
    {
        if (name.Equals("UTC", StringComparison.OrdinalIgnoreCase) || name.Equals("GMT", StringComparison.OrdinalIgnoreCase) || name.Equals("Z", StringComparison.OrdinalIgnoreCase))
        {
            return TimeZoneInfo.Utc;
        }

        return TimeZoneInfo.TryFindSystemTimeZoneById(name, out var zone) ? zone : null;
    }

    [GeneratedRegex(@"\|\s*(?<seconds>\d{9,11})\b", RegexOptions.None, MatchTimeoutMilliseconds)]
    private static partial Regex EpochSuffix();

    [GeneratedRegex(@"\bresets?\s+(?:at\s+)?(?<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)", RegexOptions.IgnoreCase, MatchTimeoutMilliseconds)]
    private static partial Regex IsoReset();

    [GeneratedRegex(@"\bresets?\s+(?:at\s+|on\s+)?(?:(?<month>jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?<day>\d{1,2})(?:,?\s+(?<year>\d{4}))?,?\s+(?:at\s+)?)?(?<hour>\d{1,2})(?::(?<minute>\d{2}))?\s*(?<meridiem>am|pm)\b(?:\s*\((?<zone>[^)]+)\))?", RegexOptions.IgnoreCase, MatchTimeoutMilliseconds)]
    private static partial Regex WallClockReset();
}
