namespace VideoWallApi.DTOs;

public record CreateTimelapseJobRequest(int CameraId, int IntervalSeconds);

public record TimelapseJobDto(
    int Id,
    int CameraId,
    string Status,
    int IntervalSeconds,
    DateTime CreatedAt,
    DateTime? StoppedAt,
    int FrameCount,
    bool HasVideo
);
