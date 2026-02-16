import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel } from "./openai";
import type { HeadlineAnalysisResult, BatchAnalysisResult } from "@/types";

// Zod schemas for structured AI output
const headlineAnalysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  emotion: z.enum([
    "curiosity",
    "fear",
    "urgency",
    "excitement",
    "trust",
    "surprise",
    "desire",
    "anger",
  ]),
  powerWords: z.array(z.string()).describe("Power/trigger words found in the headline"),
  structure: z
    .string()
    .describe(
      'The headline pattern, e.g. "How to...", "X ways to...", "Question", "Number list", "Command/CTA", "Statement", "Comparison", "Testimonial", "News"'
    ),
  score: z.number().min(1).max(10).describe("Copywriting effectiveness score 1-10"),
  tags: z.array(z.string()).max(5).describe("Relevant topic tags"),
});

const bulkAnalysisSchema = z.object({
  analyses: z.array(headlineAnalysisSchema),
});

const headlinesOutputSchema = z.object({
  headlines: z.array(z.string()),
});

export async function analyzeHeadline(
  headline: string,
  copy?: string
): Promise<HeadlineAnalysisResult> {
  const { object } = await generateObject({
    model: getModel(),
    schema: headlineAnalysisSchema,
    prompt: `Analyze this headline${copy ? " and its copy" : ""} for copywriting effectiveness.\n\nHeadline: "${headline}"${copy ? `\nCopy: "${copy.slice(0, 500)}"` : ""}`,
    temperature: 0.3,
  });

  return object;
}

export async function analyzeHeadlineBatch(
  headlines: { headline: string; copy?: string }[],
  concurrency: number = 5
): Promise<HeadlineAnalysisResult[]> {
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(concurrency);

  const chunkSize = 10;
  const results: HeadlineAnalysisResult[] = [];

  for (let i = 0; i < headlines.length; i += chunkSize) {
    const chunk = headlines.slice(i, i + chunkSize);
    const chunkResults = await limit(async () => {
      return analyzeBulkHeadlines(chunk);
    });
    results.push(...chunkResults);
  }

  return results;
}

async function analyzeBulkHeadlines(
  headlines: { headline: string; copy?: string }[]
): Promise<HeadlineAnalysisResult[]> {
  const headlineList = headlines
    .map(
      (h, i) =>
        `${i + 1}. Headline: "${h.headline}"${h.copy ? ` | Copy: "${h.copy.slice(0, 200)}"` : ""}`
    )
    .join("\n");

  const { object } = await generateObject({
    model: getModel(),
    schema: bulkAnalysisSchema,
    prompt: `Analyze these ${headlines.length} headlines for copywriting effectiveness. Return one analysis per headline in order.\n\n${headlineList}`,
    temperature: 0.3,
  });

  const analyses = object.analyses;

  // Pad if model returned fewer results
  while (analyses.length < headlines.length) {
    analyses.push({
      sentiment: "neutral",
      emotion: "curiosity",
      powerWords: [],
      structure: "Statement",
      score: 5,
      tags: [],
    });
  }

  return analyses;
}

export function computeBatchAnalysis(
  headlineResults: { headline: string; analysis: HeadlineAnalysisResult }[]
): Omit<BatchAnalysisResult, "insights"> {
  const patternCounts: Record<string, number> = {};
  const wordCounts: Record<string, number> = {};
  const sentimentCounts: Record<string, number> = {};
  const emotionCounts: Record<string, number> = {};
  let totalScore = 0;

  for (const { analysis } of headlineResults) {
    patternCounts[analysis.structure] = (patternCounts[analysis.structure] || 0) + 1;

    for (const word of analysis.powerWords) {
      const lower = word.toLowerCase();
      wordCounts[lower] = (wordCounts[lower] || 0) + 1;
    }

    sentimentCounts[analysis.sentiment] = (sentimentCounts[analysis.sentiment] || 0) + 1;
    emotionCounts[analysis.emotion] = (emotionCounts[analysis.emotion] || 0) + 1;
    totalScore += analysis.score;
  }

  const topPatterns = Object.entries(patternCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([pattern, count]) => ({ pattern, count }));

  const topPowerWords = Object.entries(wordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  return {
    totalHeadlines: headlineResults.length,
    topPatterns,
    topPowerWords,
    sentimentDistribution: sentimentCounts,
    emotionDistribution: emotionCounts,
    avgScore: headlineResults.length > 0 ? totalScore / headlineResults.length : 0,
  };
}

export async function generateInsights(
  stats: Omit<BatchAnalysisResult, "insights">
): Promise<string> {
  const { text } = await generateText({
    model: getModel(),
    prompt: `Based on this analysis of ${stats.totalHeadlines} headlines, provide actionable copywriting insights:

Top patterns: ${JSON.stringify(stats.topPatterns)}
Top power words: ${JSON.stringify(stats.topPowerWords)}
Sentiment distribution: ${JSON.stringify(stats.sentimentDistribution)}
Emotion distribution: ${JSON.stringify(stats.emotionDistribution)}
Average score: ${stats.avgScore.toFixed(1)}/10

Write 3-5 key insights about what makes these headlines effective, what patterns dominate, and recommendations for writing new headlines based on these patterns. Be specific and data-driven.`,
    temperature: 0.7,
    maxOutputTokens: 1000,
  });

  return text || "No insights generated.";
}

export async function generateHeadlines(
  topic: string,
  style?: string,
  patterns?: { pattern: string; count: number }[],
  powerWords?: { word: string; count: number }[],
  count: number = 10
): Promise<string[]> {
  const patternContext = patterns
    ? `\nUse these proven headline patterns (ordered by effectiveness): ${patterns.map((p) => p.pattern).join(", ")}`
    : "";
  const wordContext = powerWords
    ? `\nIncorporate these high-performing power words when relevant: ${powerWords.map((w) => w.word).join(", ")}`
    : "";
  const styleContext = style ? `\nStyle/tone: ${style}` : "";

  const { object } = await generateObject({
    model: getModel(),
    schema: headlinesOutputSchema,
    prompt: `Generate ${count} high-performing headlines for this topic: "${topic}"${patternContext}${wordContext}${styleContext}`,
    temperature: 0.8,
  });

  return object.headlines;
}
