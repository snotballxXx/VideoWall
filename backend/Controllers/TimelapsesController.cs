using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VideoWallApi.Data;
using VideoWallApi.DTOs;
using VideoWallApi.Models;
using VideoWallApi.Services;

namespace VideoWallApi.Controllers;

[ApiController]
[Route("api/timelapses")]
public class TimelapsesController(AppDbContext db, IConfiguration configuration, ILogger<TimelapsesController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<List<TimelapseJobDto>> GetAll([FromQuery] int? cameraId)
    {
        var query = db.TimelapseJobs.AsQueryable();
        if (cameraId is not null) query = query.Where(j => j.CameraId == cameraId);

        var jobs = await query.OrderByDescending(j => j.CreatedAt).ToListAsync();
        return jobs.Select(ToDto).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<TimelapseJobDto>> Create(CreateTimelapseJobRequest req)
    {
        if (req.IntervalSeconds < 5) return BadRequest("IntervalSeconds must be at least 5.");

        var cameraExists = await db.Cameras.AnyAsync(c => c.Id == req.CameraId);
        if (!cameraExists) return BadRequest("Camera not found.");

        var existingJobs = await db.TimelapseJobs.Where(j => j.CameraId == req.CameraId).ToListAsync();
        if (existingJobs.Any(j => j.Status == TimelapseStatus.Running))
            return Conflict("A timelapse is already running for this camera.");

        foreach (var old in existingJobs) DeleteJobFiles(old.Id);
        db.TimelapseJobs.RemoveRange(existingJobs);

        var job = new TimelapseJob
        {
            CameraId = req.CameraId,
            IntervalSeconds = req.IntervalSeconds,
        };
        db.TimelapseJobs.Add(job);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), ToDto(job));
    }

    [HttpPost("{id}/stop")]
    public async Task<ActionResult<TimelapseJobDto>> Stop(int id)
    {
        var job = await db.TimelapseJobs.FindAsync(id);
        if (job is null) return NotFound();
        if (job.Status != TimelapseStatus.Running) return BadRequest("Job is not running.");

        job.Status = TimelapseStatus.Stopped;
        job.StoppedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        if (job.FrameCount == 0)
        {
            job.Status = TimelapseStatus.Failed;
            await db.SaveChangesAsync();
            return Ok(ToDto(job));
        }

        job.Status = TimelapseStatus.Exporting;
        await db.SaveChangesAsync();

        bool exported;
        try
        {
            exported = await ExportVideoAsync(job.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Timelapse job {JobId}: video export failed", job.Id);
            exported = false;
        }

        job.Status = exported ? TimelapseStatus.Completed : TimelapseStatus.Failed;
        await db.SaveChangesAsync();

        return Ok(ToDto(job));
    }

    [HttpGet("{id}/download")]
    public async Task<IActionResult> Download(int id)
    {
        var job = await db.TimelapseJobs.Include(j => j.Camera).FirstOrDefaultAsync(j => j.Id == id);
        if (job is null) return NotFound();

        var outputPath = Path.Combine(TimelapsePaths.GetJobDirectory(configuration, job.Id), "output.mp4");
        if (job.Status != TimelapseStatus.Completed || !System.IO.File.Exists(outputPath))
            return NotFound("Video not available.");

        var fileName = $"{SanitizeFileName(job.Camera.Name)}-timelapse-{job.Id}.mp4";
        return PhysicalFile(outputPath, "video/mp4", fileName);
    }

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var sanitized = new string(name.Select(c => invalid.Contains(c) ? '-' : c).ToArray()).Trim();
        return string.IsNullOrEmpty(sanitized) ? "camera" : sanitized;
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var job = await db.TimelapseJobs.FindAsync(id);
        if (job is null) return NotFound();

        DeleteJobFiles(job.Id);
        db.TimelapseJobs.Remove(job);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private void DeleteJobFiles(int jobId)
    {
        var jobDir = TimelapsePaths.GetJobDirectory(configuration, jobId);
        if (Directory.Exists(jobDir)) Directory.Delete(jobDir, recursive: true);
    }

    private async Task<bool> ExportVideoAsync(int jobId)
    {
        var jobDir = TimelapsePaths.GetJobDirectory(configuration, jobId);
        var ffmpegPath = configuration["Timelapse:FfmpegPath"] ?? "ffmpeg";
        var framerate = configuration["Timelapse:OutputFramerate"] ?? "10";

        var psi = new ProcessStartInfo
        {
            FileName = ffmpegPath,
            WorkingDirectory = jobDir,
            UseShellExecute = false,
        };
        psi.ArgumentList.Add("-y");
        psi.ArgumentList.Add("-nostdin");
        psi.ArgumentList.Add("-framerate");
        psi.ArgumentList.Add(framerate);
        psi.ArgumentList.Add("-i");
        psi.ArgumentList.Add("frame_%06d.jpg");
        psi.ArgumentList.Add("-c:v");
        psi.ArgumentList.Add("libx264");
        psi.ArgumentList.Add("-pix_fmt");
        psi.ArgumentList.Add("yuv420p");
        psi.ArgumentList.Add("output.mp4");

        using var process = Process.Start(psi);
        if (process is null) return false;
        await process.WaitForExitAsync();

        return process.ExitCode == 0 && System.IO.File.Exists(Path.Combine(jobDir, "output.mp4"));
    }

    private TimelapseJobDto ToDto(TimelapseJob j)
    {
        var hasVideo = System.IO.File.Exists(Path.Combine(TimelapsePaths.GetJobDirectory(configuration, j.Id), "output.mp4"));
        return new(j.Id, j.CameraId, j.Status.ToString(), j.IntervalSeconds, j.CreatedAt, j.StoppedAt, j.FrameCount, hasVideo);
    }
}
