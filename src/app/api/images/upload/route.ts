import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const collectionId = formData.get("collectionId") as string;
    const collectionName = formData.get("collectionName") as string;
    const files = formData.getAll("images") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    // Create or get collection
    let collection;
    if (collectionId) {
      collection = await prisma.imageCollection.findUnique({
        where: { id: collectionId },
      });
      if (!collection) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }
    } else {
      collection = await prisma.imageCollection.create({
        data: { name: collectionName || `Collection ${Date.now()}` },
      });
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), "public", "uploads", collection.id);
    await mkdir(uploadDir, { recursive: true });

    // Save files and create records
    const savedImages = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filepath = path.join(uploadDir, filename);
      await writeFile(filepath, buffer);

      const image = await prisma.image.create({
        data: {
          collectionId: collection.id,
          filename,
          filepath: `/uploads/${collection.id}/${filename}`,
        },
      });
      savedImages.push(image);
    }

    // Update collection count
    await prisma.imageCollection.update({
      where: { id: collection.id },
      data: { totalImages: { increment: files.length } },
    });

    return NextResponse.json({
      collectionId: collection.id,
      uploaded: savedImages.length,
      images: savedImages,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const collectionId = request.nextUrl.searchParams.get("collectionId");

  if (collectionId) {
    const collection = await prisma.imageCollection.findUnique({
      where: { id: collectionId },
      include: { images: { orderBy: { createdAt: "desc" } } },
    });
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    return NextResponse.json(collection);
  }

  const collections = await prisma.imageCollection.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { images: true } } },
  });
  return NextResponse.json(collections);
}
