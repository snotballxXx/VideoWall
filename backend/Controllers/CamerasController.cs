using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VideoWallApi.Data;
using VideoWallApi.DTOs;
using VideoWallApi.Models;

namespace VideoWallApi.Controllers;

[ApiController]
[Route("api/cameras")]
public class CamerasController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<CameraDto>> Create(CreateCameraRequest req)
    {
        var layoutExists = await db.Layouts.AnyAsync(l => l.Id == req.LayoutId);
        if (!layoutExists) return BadRequest("Layout not found.");

        // Replace any existing camera at this position
        var existing = await db.Cameras.FirstOrDefaultAsync(
            c => c.LayoutId == req.LayoutId && c.Row == req.Row && c.Column == req.Column);
        if (existing is not null) db.Cameras.Remove(existing);

        var camera = new Camera
        {
            LayoutId = req.LayoutId,
            Name = req.Name,
            Url = req.Url,
            Enabled = req.Enabled,
            Row = req.Row,
            Column = req.Column
        };
        db.Cameras.Add(camera);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Create), ToDto(camera));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<CameraDto>> Update(int id, UpdateCameraRequest req)
    {
        var camera = await db.Cameras.FindAsync(id);
        if (camera is null) return NotFound();

        camera.Name = req.Name;
        camera.Url = req.Url;
        camera.Enabled = req.Enabled;
        await db.SaveChangesAsync();
        return Ok(ToDto(camera));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var camera = await db.Cameras.FindAsync(id);
        if (camera is null) return NotFound();
        db.Cameras.Remove(camera);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static CameraDto ToDto(Camera c) =>
        new(c.Id, c.LayoutId, c.Name, c.Url, c.Enabled, c.Row, c.Column);
}
