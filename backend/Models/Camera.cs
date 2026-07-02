namespace VideoWallApi.Models;

public class Camera
{
    public int Id { get; set; }
    public int LayoutId { get; set; }
    public Layout Layout { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public int Row { get; set; }
    public int Column { get; set; }
}
