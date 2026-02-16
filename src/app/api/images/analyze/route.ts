import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeImage } from "@/lib/image-analyzer";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { collectionId, imageId, concurrency = 3 } = await request.json();

    if (!collectionId && !imageId) {
      return NextResponse.json(
        { error: "collectionId or imageId required" },
        { status: 400 }
      );
    }

    // Analyze single image
    if (imageId) {
      const image = await prisma.image.findUnique({ where: { id: imageId } });
      if (!image) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }

      const fullPath = path.join(process.cwd(), "public", image.filepath);
      const analysis = await analyzeImage(fullPath);

      const updated = await prisma.image.update({
        where: { id: imageId },
        data: {
          description: analysis.description,
          keywords: JSON.stringify(analysis.keywords),
          colors: JSON.stringify(analysis.colors),
          objects: JSON.stringify(analysis.objects),
          mood: analysis.mood,
          style: analysis.style,
          analyzed: true,
        },
      });

      return NextResponse.json({ image: updated, analysis });
    }

    // Analyze all unanalyzed images in collection
    const unanalyzed = await prisma.image.findMany({
      where: { collectionId, analyzed: false },
    });

    if (unanalyzed.length === 0) {
      return NextResponse.json({ message: "All images already analyzed", analyzed: 0 });
    }

    // Process in background
    processImagesInBackground(unanalyzed, concurrency);

    return NextResponse.json({
      message: `Analyzing ${unanalyzed.length} images in background`,
      total: unanalyzed.length,
      status: "processing",
    });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function processImagesInBackground(
  images: { id: string; filepath: string }[],
  concurrency: number
) {
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(concurrency);

  await Promise.all(
    images.map((img) =>
      limit(async () => {
        try {
          const fullPath = path.join(process.cwd(), "public", img.filepath);
          const analysis = await analyzeImage(fullPath);

          await prisma.image.update({
            where: { id: img.id },
            data: {
              description: analysis.description,
              keywords: JSON.stringify(analysis.keywords),
              colors: JSON.stringify(analysis.colors),
              objects: JSON.stringify(analysis.objects),
              mood: analysis.mood,
              style: analysis.style,
              analyzed: true,
            },
          });
        } catch (error) {
          console.error(`Failed to analyze image ${img.id}:`, error);
        }
      })
    )
  );
}

export async function GET(request: NextRequest) {
  const collectionId = request.nextUrl.searchParams.get("collectionId");

  if (!collectionId) {
    return NextResponse.json({ error: "collectionId required" }, { status: 400 });
  }

  const stats = await prisma.image.groupBy({
    by: ["analyzed"],
    where: { collectionId },
    _count: true,
  });

  const total = stats.reduce((sum, s) => sum + s._count, 0);
  const analyzed = stats.find((s) => s.analyzed)?._count || 0;

  return NextResponse.json({ collectionId, total, analyzed, pending: total - analyzed });
}
