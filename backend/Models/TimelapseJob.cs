namespace VideoWallApi.Models;

public enum TimelapseStatus { Running, Stopped, Exporting, Completed, Failed }

public class TimelapseJob
{
    public int Id { get; set; }
    public int CameraId { get; set; }
    public Camera Camera { get; set; } = null!;
    public int IntervalSeconds { get; set; }
    public TimelapseStatus Status { get; set; } = TimelapseStatus.Running;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastCapturedAt { get; set; }
    public DateTime? StoppedAt { get; set; }
    public int FrameCount { get; set; }
}
