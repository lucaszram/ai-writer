import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Create a new slideshow
export async function POST(request: NextRequest) {
  try {
    const { collectionId, name, imageIds, description } = await request.json();

    if (!collectionId || !name || !imageIds || imageIds.length === 0) {
      return NextResponse.json(
        { error: "collectionId, name, and imageIds are required" },
        { status: 400 }
      );
    }

    const collection = await prisma.imageCollection.findUnique({
      where: { id: collectionId },
    });
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const slideshow = await prisma.slideshow.create({
      data: {
        collectionId,
        name,
        description: description || null,
        slots: {
          create: (imageIds as string[]).map((imageId: string, index: number) => ({
            position: index,
            imageId,
          })),
        },
      },
      include: {
        slots: {
          include: { image: true },
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json(slideshow);
  } catch (error) {
    console.error("Slideshow create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// List slideshows
export async function GET(request: NextRequest) {
  const collectionId = request.nextUrl.searchParams.get("collectionId");
  const slideshowId = request.nextUrl.searchParams.get("id");

  if (slideshowId) {
    const slideshow = await prisma.slideshow.findUnique({
      where: { id: slideshowId },
      include: {
        slots: {
          include: { image: true },
          orderBy: { position: "asc" },
        },
      },
    });
    if (!slideshow) {
      return NextResponse.json({ error: "Slideshow not found" }, { status: 404 });
    }
    return NextResponse.json(slideshow);
  }

  const where = collectionId ? { collectionId } : {};
  const slideshows = await prisma.slideshow.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { slots: true } },
    },
  });

  return NextResponse.json(slideshows);
}

// Create iteration of a slideshow (replace specific slots)
export async function PUT(request: NextRequest) {
  try {
    const { slideshowId, replacements } = await request.json();

    if (!slideshowId || !replacements || replacements.length === 0) {
      return NextResponse.json(
        { error: "slideshowId and replacements array required" },
        { status: 400 }
      );
    }

    // Get original slideshow
    const original = await prisma.slideshow.findUnique({
      where: { id: slideshowId },
      include: {
        slots: {
          include: { image: true },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Slideshow not found" }, { status: 404 });
    }

    // Create new version
    const newVersion = await prisma.slideshow.create({
      data: {
        collectionId: original.collectionId,
        name: `${original.name} v${original.version + 1}`,
        version: original.version + 1,
        parentId: original.id,
      },
    });

    // Clone slots, applying replacements
    const replacementMap = new Map(
      (
        replacements as {
          position: number;
          newImageId: string;
          source: string;
          pinterestUrl?: string;
        }[]
      ).map(
        (r: {
          position: number;
          newImageId: string;
          source: string;
          pinterestUrl?: string;
        }) => [r.position, r]
      )
    );

    for (const slot of original.slots) {
      const replacement = replacementMap.get(slot.position);

      await prisma.slideshowSlot.create({
        data: {
          slideshowId: newVersion.id,
          position: slot.position,
          imageId: replacement ? replacement.newImageId : slot.imageId,
          originalImageId: replacement ? slot.imageId : null,
          replacementSource: replacement ? replacement.source : null,
          pinterestUrl: replacement?.pinterestUrl || null,
        },
      });
    }

    // Return the new version with all data
    const result = await prisma.slideshow.findUnique({
      where: { id: newVersion.id },
      include: {
        slots: {
          include: { image: true },
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Iteration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
