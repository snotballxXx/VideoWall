namespace VideoWallApi.Services;

public static class TimelapsePaths
{
    public static string GetStorageRoot(IConfiguration configuration) =>
        Path.Combine(Directory.GetCurrentDirectory(), configuration["Timelapse:StoragePath"] ?? "timelapse-storage");

    public static string GetJobDirectory(IConfiguration configuration, int jobId) =>
        Path.Combine(GetStorageRoot(configuration), jobId.ToString());
}
