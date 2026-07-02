using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VideoWallApi.Data;
using VideoWallApi.DTOs;
using VideoWallApi.Models;

namespace VideoWallApi.Controllers;

[ApiController]
[Route("api/layouts")]
public class LayoutsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<List<LayoutDto>> GetAll()
    {
        var layouts = await db.Layouts
            .Include(l => l.Cameras)
            .OrderBy(l => l.Order)
            .ToListAsync();

        return layouts.Select(ToDto).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<LayoutDto>> Create(CreateLayoutRequest req)
    {
        var layout = new Layout
        {
            Name = req.Name,
            Rows = req.Rows,
            Columns = req.Columns,
            Order = req.Order
        };
        db.Layouts.Add(layout);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), ToDto(layout));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<LayoutDto>> Update(int id, UpdateLayoutRequest req)
    {
        var layout = await db.Layouts.Include(l => l.Cameras).FirstOrDefaultAsync(l => l.Id == id);
        if (layout is null) return NotFound();

        layout.Name = req.Name;
        layout.Order = req.Order;

        // If grid shrinks, remove cameras that fall outside the new bounds
        if (req.Rows != layout.Rows || req.Columns != layout.Columns)
        {
            var outOfBounds = layout.Cameras
                .Where(c => c.Row >= req.Rows || c.Column >= req.Columns)
                .ToList();
            db.Cameras.RemoveRange(outOfBounds);
            layout.Rows = req.Rows;
            layout.Columns = req.Columns;
        }

        await db.SaveChangesAsync();
        await db.Entry(layout).Collection(l => l.Cameras).LoadAsync();
        return Ok(ToDto(layout));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var layout = await db.Layouts.FindAsync(id);
        if (layout is null) return NotFound();
        db.Layouts.Remove(layout);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static LayoutDto ToDto(Layout l) => new(
        l.Id, l.Name, l.Rows, l.Columns, l.Order,
        l.Cameras.Select(c => new CameraDto(c.Id, c.LayoutId, c.Name, c.Url, c.Enabled, c.Row, c.Column)).ToList()
    );
}
