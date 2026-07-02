namespace VideoWallApi.DTOs;

public record CreateLayoutRequest(string Name, int Rows, int Columns, int Order);
public record UpdateLayoutRequest(string Name, int Rows, int Columns, int Order);

public record CameraDto(int Id, int LayoutId, string Name, string Url, bool Enabled, int Row, int Column);
public record LayoutDto(int Id, string Name, int Rows, int Columns, int Order, List<CameraDto> Cameras);

public record CreateCameraRequest(int LayoutId, string Name, string Url, bool Enabled, int Row, int Column);
public record UpdateCameraRequest(string Name, string Url, bool Enabled);
