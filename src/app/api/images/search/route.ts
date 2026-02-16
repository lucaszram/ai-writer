import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchPinterest } from "@/lib/pinterest";
import { findSimilarByKeywords } from "@/lib/image-analyzer";

export async function POST(request: NextRequest) {
  try {
    const { keywords, imageId, source = "both", limit = 20 } = await request.json();

    let searchKeywords: string[] = keywords || [];

    // If imageId provided, use that image's keywords
    if (imageId) {
      const image = await prisma.image.findUnique({ where: { id: imageId } });
      if (!image) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      if (!image.analyzed) {
        return NextResponse.json(
          { error: "Image not yet analyzed. Run analysis first." },
          { status: 400 }
        );
      }
      searchKeywords = image.keywords ? JSON.parse(image.keywords) : [];
    }

    if (searchKeywords.length === 0) {
      return NextResponse.json({ error: "No keywords to search with" }, { status: 400 });
    }

    const results: {
      pinterest?: Awaited<ReturnType<typeof searchPinterest>>;
      similar?: { id: string; score: number; image?: unknown }[];
    } = {};

    // Search Pinterest
    if (source === "pinterest" || source === "both") {
      try {
        results.pinterest = await searchPinterest(searchKeywords, limit);
      } catch (error) {
        results.pinterest = [];
        console.error("Pinterest search failed:", error);
      }
    }

    // Search in local collection for similar images
    if (source === "local" || source === "both") {
      const allImages = await prisma.image.findMany({
        where: {
          analyzed: true,
          ...(imageId ? { NOT: { id: imageId } } : {}),
        },
        select: { id: true, keywords: true },
      });

      const parsedImages = allImages.map((img) => ({
        id: img.id,
        keywords: img.keywords ? JSON.parse(img.keywords) : [],
      }));

      const similar = await findSimilarByKeywords(searchKeywords, parsedImages);
      const topSimilar = similar.slice(0, limit);

      // Fetch full image data for top results
      const imageIds = topSimilar.map((s) => s.id);
      const fullImages = await prisma.image.findMany({
        where: { id: { in: imageIds } },
      });
      const imageMap = new Map(fullImages.map((img) => [img.id, img]));

      results.similar = topSimilar.map((s) => ({
        ...s,
        image: imageMap.get(s.id),
      }));
    }

    return NextResponse.json({
      keywords: searchKeywords,
      results,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
