using Microsoft.EntityFrameworkCore;
using VideoWallApi.Models;

namespace VideoWallApi.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Layout> Layouts => Set<Layout>();
    public DbSet<Camera> Cameras => Set<Camera>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Camera>()
            .HasOne(c => c.Layout)
            .WithMany(l => l.Cameras)
            .HasForeignKey(c => c.LayoutId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
