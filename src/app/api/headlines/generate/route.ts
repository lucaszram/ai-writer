import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateHeadlines } from "@/lib/headline-analyzer";

export async function POST(request: NextRequest) {
  try {
    const { topic, style, count = 10, batchId } = await request.json();

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    let patterns: { pattern: string; count: number }[] | undefined;
    let powerWords: { word: string; count: number }[] | undefined;

    // If batchId provided, use learned patterns from that batch
    if (batchId) {
      const analysis = await prisma.headlineAnalysis.findUnique({
        where: { batchId },
      });

      if (analysis) {
        patterns = JSON.parse(analysis.topPatterns);
        powerWords = JSON.parse(analysis.topPowerWords);
      }
    }

    const headlines = await generateHeadlines(topic, style, patterns, powerWords, count);

    return NextResponse.json({
      topic,
      style: style || "default",
      basedOnBatch: batchId || null,
      headlines,
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
