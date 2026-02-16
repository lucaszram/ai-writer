import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeHeadlinesBatch } from "@/lib/scraper";
import { analyzeHeadlineBatch } from "@/lib/headline-analyzer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchName, urls } = body as { batchName: string; urls: string[] };

    if (!batchName || !urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "batchName and urls array are required" },
        { status: 400 }
      );
    }

    // Validate and clean URLs
    const validUrls = urls
      .map((u: string) => u.trim())
      .filter((u: string) => {
        try {
          new URL(u);
          return true;
        } catch {
          return false;
        }
      });

    // Create batch record
    const batch = await prisma.headlineBatch.create({
      data: {
        name: batchName,
        totalUrls: validUrls.length,
        status: "processing",
      },
    });

    // Start async processing (non-blocking response)
    processInBackground(batch.id, validUrls);

    return NextResponse.json({
      batchId: batch.id,
      totalUrls: validUrls.length,
      invalidUrls: urls.length - validUrls.length,
      status: "processing",
      message: `Processing ${validUrls.length} URLs. Use GET /api/headlines/ingest?batchId=${batch.id} to check status.`,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function processInBackground(batchId: string, urls: string[]) {
  try {
    // Step 1: Scrape headlines
    const scraped = await scrapeHeadlinesBatch(urls, 10, async (processed) => {
      await prisma.headlineBatch.update({
        where: { id: batchId },
        data: { processed },
      });
    });

    // Step 2: Analyze with AI (in batches of 10)
    const headlineTexts = scraped.map((s) => ({
      headline: s.headline,
      copy: s.copy,
    }));
    const analyses = await analyzeHeadlineBatch(headlineTexts);

    // Step 3: Save all headlines with analysis
    const headlineData = scraped.map((s, i) => ({
      batchId,
      sourceUrl: s.url,
      headline: s.headline,
      subheadline: s.subheadline || null,
      copy: s.copy || null,
      metaTitle: s.metaTitle || null,
      metaDesc: s.metaDescription || null,
      ogTitle: s.ogTitle || null,
      sentiment: analyses[i]?.sentiment || null,
      emotion: analyses[i]?.emotion || null,
      powerWords: analyses[i]?.powerWords ? JSON.stringify(analyses[i].powerWords) : null,
      structure: analyses[i]?.structure || null,
      score: analyses[i]?.score || null,
      tags: analyses[i]?.tags ? JSON.stringify(analyses[i].tags) : null,
    }));

    // Batch insert
    for (const data of headlineData) {
      await prisma.headline.create({ data });
    }

    // Update batch status
    await prisma.headlineBatch.update({
      where: { id: batchId },
      data: {
        status: "completed",
        processed: urls.length,
      },
    });
  } catch (error) {
    console.error(`Background processing failed for batch ${batchId}:`, error);
    await prisma.headlineBatch.update({
      where: { id: batchId },
      data: { status: "failed" },
    });
  }
}

export async function GET(request: NextRequest) {
  const batchId = request.nextUrl.searchParams.get("batchId");

  if (batchId) {
    const batch = await prisma.headlineBatch.findUnique({
      where: { id: batchId },
      include: { _count: { select: { headlines: true } } },
    });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }
    return NextResponse.json({
      ...batch,
      headlineCount: batch._count.headlines,
    });
  }

  // List all batches
  const batches = await prisma.headlineBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { headlines: true } } },
  });

  return NextResponse.json(batches);
}
