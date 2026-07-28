using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using VideoWallApi.Data;
using VideoWallApi.Models;

namespace VideoWallApi.Services;

public class TimelapseCaptureService(
    IServiceScopeFactory scopeFactory,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<TimelapseCaptureService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await CaptureDueFramesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Timelapse capture tick failed");
            }
        }
    }

    private async Task CaptureDueFramesAsync(CancellationToken stoppingToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;
        var dueJobs = await db.TimelapseJobs
            .Include(j => j.Camera)
            .Where(j => j.Status == TimelapseStatus.Running)
            .ToListAsync(stoppingToken);

        foreach (var job in dueJobs)
        {
            var since = job.LastCapturedAt ?? job.CreatedAt;
            if ((now - since).TotalSeconds < job.IntervalSeconds) continue;

            var frame = await TryCaptureFrameAsync(DeriveSnapshotUrl(job.Camera.Url), stoppingToken);
            if (frame is null)
            {
                logger.LogWarning("Timelapse job {JobId}: failed to capture frame from camera {CameraId}", job.Id, job.CameraId);
                continue;
            }

            var jobDir = TimelapsePaths.GetJobDirectory(configuration, job.Id);
            Directory.CreateDirectory(jobDir);
            var framePath = Path.Combine(jobDir, $"frame_{job.FrameCount + 1:D6}.jpg");
            await File.WriteAllBytesAsync(framePath, frame, stoppingToken);

            job.FrameCount++;
            job.LastCapturedAt = now;
            await db.SaveChangesAsync(stoppingToken);
        }
    }

    // go2rtc's /stream.html is an interactive player page (WebRTC/MSE), not a fetchable image.
    // Derive its /api/frame.jpeg snapshot endpoint from the same src on the same host.
    private static string DeriveSnapshotUrl(string cameraUrl)
    {
        if (!Uri.TryCreate(cameraUrl, UriKind.Absolute, out var uri)) return cameraUrl;
        if (!uri.AbsolutePath.EndsWith("/stream.html", StringComparison.OrdinalIgnoreCase)) return cameraUrl;

        var query = QueryHelpers.ParseQuery(uri.Query);
        if (!query.TryGetValue("src", out var src) || src.Count == 0 || string.IsNullOrEmpty(src[0])) return cameraUrl;

        return QueryHelpers.AddQueryString($"{uri.Scheme}://{uri.Authority}/api/frame.jpeg", "src", src[0]!);
    }

    private async Task<byte[]?> TryCaptureFrameAsync(string url, CancellationToken outerToken)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(outerToken);
        cts.CancelAfter(TimeSpan.FromSeconds(8));

        try
        {
            var client = httpClientFactory.CreateClient();
            using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cts.Token);
            if (!response.IsSuccessStatusCode) return null;

            await using var stream = await response.Content.ReadAsStreamAsync(cts.Token);
            using var buffer = new MemoryStream();
            var chunk = new byte[16 * 1024];
            const int maxBytes = 10 * 1024 * 1024;
            int read;
            while (buffer.Length < maxBytes && (read = await stream.ReadAsync(chunk, cts.Token)) > 0)
            {
                buffer.Write(chunk, 0, read);
                var frame = ExtractJpeg(buffer.ToArray());
                if (frame is not null) return frame;
            }

            return ExtractJpeg(buffer.ToArray());
        }
        catch (OperationCanceledException)
        {
            return null;
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    private static byte[]? ExtractJpeg(byte[] data)
    {
        var start = -1;
        for (var i = 0; i < data.Length - 1; i++)
        {
            if (data[i] != 0xFF || data[i + 1] != 0xD8) continue;
            start = i;
            break;
        }
        if (start == -1) return null;

        var end = -1;
        for (var i = start + 2; i < data.Length - 1; i++)
        {
            if (data[i] != 0xFF || data[i + 1] != 0xD9) continue;
            end = i + 2;
            break;
        }
        if (end == -1) return null;

        return data[start..end];
    }
}
