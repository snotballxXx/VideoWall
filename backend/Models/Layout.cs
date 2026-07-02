namespace VideoWallApi.Models;

public class Layout
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Rows { get; set; }
    public int Columns { get; set; }
    public int Order { get; set; }
    public List<Camera> Cameras { get; set; } = new();
}
