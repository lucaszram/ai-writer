import { NextRequest, NextResponse } from "next/server";
import { searchImages } from "@/lib/image-search";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywords, imageId, query, source = "both", collectionId, limit = 20 } = body;

    if (!keywords && !imageId && !query) {
      return NextResponse.json(
        { error: "Provide keywords, imageId, or query to search" },
        { status: 400 }
      );
    }

    const results = await searchImages({
      keywords,
      imageId,
      query,
      source,
      collectionId,
      limit,
    });

    return NextResponse.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Search error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
