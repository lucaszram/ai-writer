import { getOpenAI } from "./openai";
import type { HeadlineAnalysisResult, BatchAnalysisResult } from "@/types";

export async function analyzeHeadline(
  headline: string,
  copy?: string
): Promise<HeadlineAnalysisResult> {
  const prompt = `Analyze this headline${copy ? " and its copy" : ""} for copywriting effectiveness.

Headline: "${headline}"
${copy ? `Copy: "${copy.slice(0, 500)}"` : ""}

Respond in JSON with exactly these fields:
{
  "sentiment": "positive" | "negative" | "neutral",
  "emotion": one of "curiosity", "fear", "urgency", "excitement", "trust", "surprise", "desire", "anger",
  "powerWords": [list of power/trigger words found in the headline],
  "structure": the pattern like "How to...", "X ways to...", "Question", "Number list", "Command/CTA", "Statement", "Comparison", "Testimonial", "News",
  "score": 1-10 effectiveness score,
  "tags": [relevant topic tags, max 5]
}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    sentiment: result.sentiment || "neutral",
    emotion: result.emotion || "curiosity",
    powerWords: result.powerWords || [],
    structure: result.structure || "Statement",
    score: result.score || 5,
    tags: result.tags || [],
  };
}

export async function analyzeHeadlineBatch(
  headlines: { headline: string; copy?: string }[],
  concurrency: number = 5
): Promise<HeadlineAnalysisResult[]> {
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(concurrency);

  // Process in chunks to avoid rate limits - analyze up to 10 at once with a single API call
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

  const prompt = `Analyze these ${headlines.length} headlines for copywriting effectiveness.

${headlineList}

Respond in JSON with an "analyses" array, one entry per headline, each with:
{
  "sentiment": "positive" | "negative" | "neutral",
  "emotion": one of "curiosity", "fear", "urgency", "excitement", "trust", "surprise", "desire", "anger",
  "powerWords": [power/trigger words found],
  "structure": pattern like "How to...", "X ways to...", "Question", "Number list", "Command/CTA", "Statement", "Comparison", "Testimonial", "News",
  "score": 1-10 effectiveness score,
  "tags": [topic tags, max 5]
}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content || '{"analyses":[]}');
  const analyses: HeadlineAnalysisResult[] = (result.analyses || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => ({
      sentiment: a.sentiment || "neutral",
      emotion: a.emotion || "curiosity",
      powerWords: a.powerWords || [],
      structure: a.structure || "Statement",
      score: a.score || 5,
      tags: a.tags || [],
    })
  );

  // Pad if API returned fewer results
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
    // Patterns
    patternCounts[analysis.structure] = (patternCounts[analysis.structure] || 0) + 1;

    // Power words
    for (const word of analysis.powerWords) {
      const lower = word.toLowerCase();
      wordCounts[lower] = (wordCounts[lower] || 0) + 1;
    }

    // Sentiment
    sentimentCounts[analysis.sentiment] = (sentimentCounts[analysis.sentiment] || 0) + 1;

    // Emotion
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
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Based on this analysis of ${stats.totalHeadlines} headlines, provide actionable copywriting insights:

Top patterns: ${JSON.stringify(stats.topPatterns)}
Top power words: ${JSON.stringify(stats.topPowerWords)}
Sentiment distribution: ${JSON.stringify(stats.sentimentDistribution)}
Emotion distribution: ${JSON.stringify(stats.emotionDistribution)}
Average score: ${stats.avgScore.toFixed(1)}/10

Write 3-5 key insights about what makes these headlines effective, what patterns dominate, and recommendations for writing new headlines based on these patterns. Be specific and data-driven.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0].message.content || "No insights generated.";
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

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Generate ${count} high-performing headlines for this topic: "${topic}"
${patternContext}${wordContext}${styleContext}

Respond in JSON: { "headlines": ["headline1", "headline2", ...] }`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const result = JSON.parse(response.choices[0].message.content || '{"headlines":[]}');
  return result.headlines || [];
}
