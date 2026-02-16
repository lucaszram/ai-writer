import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeBatchAnalysis, generateInsights } from "@/lib/headline-analyzer";

export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json();

    if (!batchId) {
      return NextResponse.json({ error: "batchId is required" }, { status: 400 });
    }

    const batch = await prisma.headlineBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    if (batch.status !== "completed") {
      return NextResponse.json(
        { error: "Batch processing not completed yet", status: batch.status },
        { status: 400 }
      );
    }

    // Get all headlines from this batch
    const headlines = await prisma.headline.findMany({
      where: { batchId },
    });

    // Compute statistics
    const headlineResults = headlines.map((h) => ({
      headline: h.headline,
      analysis: {
        sentiment: h.sentiment || "neutral",
        emotion: h.emotion || "curiosity",
        powerWords: h.powerWords ? JSON.parse(h.powerWords) : [],
        structure: h.structure || "Statement",
        score: h.score || 5,
        tags: h.tags ? JSON.parse(h.tags) : [],
      },
    }));

    const stats = computeBatchAnalysis(headlineResults);
    const insights = await generateInsights(stats);

    // Save or update analysis
    const analysis = await prisma.headlineAnalysis.upsert({
      where: { batchId },
      update: {
        totalHeadlines: stats.totalHeadlines,
        topPatterns: JSON.stringify(stats.topPatterns),
        topPowerWords: JSON.stringify(stats.topPowerWords),
        sentimentDist: JSON.stringify(stats.sentimentDistribution),
        emotionDist: JSON.stringify(stats.emotionDistribution),
        avgScore: stats.avgScore,
        insights,
      },
      create: {
        batchId,
        totalHeadlines: stats.totalHeadlines,
        topPatterns: JSON.stringify(stats.topPatterns),
        topPowerWords: JSON.stringify(stats.topPowerWords),
        sentimentDist: JSON.stringify(stats.sentimentDistribution),
        emotionDist: JSON.stringify(stats.emotionDistribution),
        avgScore: stats.avgScore,
        insights,
      },
    });

    return NextResponse.json({
      ...analysis,
      topPatterns: stats.topPatterns,
      topPowerWords: stats.topPowerWords,
      sentimentDistribution: stats.sentimentDistribution,
      emotionDistribution: stats.emotionDistribution,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const batchId = request.nextUrl.searchParams.get("batchId");

  if (!batchId) {
    return NextResponse.json({ error: "batchId query param required" }, { status: 400 });
  }

  const analysis = await prisma.headlineAnalysis.findUnique({
    where: { batchId },
  });

  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...analysis,
    topPatterns: JSON.parse(analysis.topPatterns),
    topPowerWords: JSON.parse(analysis.topPowerWords),
    sentimentDist: JSON.parse(analysis.sentimentDist),
    emotionDist: JSON.parse(analysis.emotionDist),
  });
}
