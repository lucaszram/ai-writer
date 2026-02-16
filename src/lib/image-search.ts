import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel } from "./openai";
import { prisma } from "./db";
import { findSimilarByKeywords } from "./image-analyzer";
import { searchPinterest, type PinterestResult } from "./pinterest";

// Schema for AI-expanded search query
const expandedSearchSchema = z.object({
  expandedKeywords: z
    .array(z.string())
    .describe("Expanded list of keywords including synonyms and related terms for broader search"),
  pinterestQuery: z
    .string()
    .describe("Optimized search query string for Pinterest (2-5 words, most impactful terms)"),
  categories: z
    .array(z.string())
    .describe("Image categories that match: e.g. lifestyle, product, nature, food, tech, fashion"),
  mood: z.string().describe("Target mood for the images"),
  style: z.string().describe("Target visual style"),
});

export interface SearchRequest {
  // Search by keywords (text input)
  keywords?: string[];
  // Search by imageId (use that image's AI-extracted keywords)
  imageId?: string;
  // Free text query (AI interprets it)
  query?: string;
  // Where to search
  source?: "pinterest" | "local" | "both";
  // Collection to search within (for local)
  collectionId?: string;
  limit?: number;
}

export interface SearchResults {
  keywords: string[];
  expandedKeywords: string[];
  pinterestQuery: string;
  pinterest: PinterestResult[];
  local: {
    id: string;
    score: number;
    filepath: string;
    filename: string;
    description: string | null;
    keywords: string[];
    mood: string | null;
    style: string | null;
  }[];
}

/**
 * AI-powered image search.
 *
 * 1. Takes keywords, imageId, or free text query
 * 2. Uses AI to expand and optimize the search terms
 * 3. Searches Pinterest (via your external service) + local collection
 * 4. Ranks local results by keyword similarity (Jaccard)
 */
export async function searchImages(req: SearchRequest): Promise<SearchResults> {
  const limit = req.limit || 20;
  let baseKeywords: string[] = req.keywords || [];

  // If searching by imageId, get that image's keywords
  if (req.imageId) {
    const image = await prisma.image.findUnique({ where: { id: req.imageId } });
    if (!image || !image.analyzed) {
      throw new Error("Image not found or not yet analyzed");
    }
    baseKeywords = image.keywords ? JSON.parse(image.keywords) : [];
  }

  // If searching by free text query, extract keywords with AI
  if (req.query && baseKeywords.length === 0) {
    const { object } = await generateObject({
      model: getModel(),
      schema: z.object({
        keywords: z
          .array(z.string())
          .describe("10-15 specific visual keywords to search for images matching this description"),
      }),
      prompt: `Extract visual search keywords from this image search query: "${req.query}"\n\nThink about: objects, scenes, colors, moods, styles that would appear in matching images.`,
      temperature: 0.3,
    });
    baseKeywords = object.keywords;
  }

  if (baseKeywords.length === 0) {
    throw new Error("No keywords to search with. Provide keywords, imageId, or query.");
  }

  // Expand keywords with AI for better search coverage
  const { object: expanded } = await generateObject({
    model: getModel(),
    schema: expandedSearchSchema,
    prompt: `I'm searching for images similar to one described by these keywords: ${baseKeywords.join(", ")}

Expand these into:
1. A broader keyword list (include synonyms, related visual concepts, and variations)
2. An optimized Pinterest search query (short, 2-5 impactful words)
3. Matching image categories
4. Target mood and style`,
    temperature: 0.4,
  });

  // Search Pinterest (external service)
  let pinterestResults: PinterestResult[] = [];
  if (req.source !== "local") {
    try {
      pinterestResults = await searchPinterest(
        expanded.expandedKeywords.slice(0, 5),
        limit
      );
    } catch {
      // Pinterest service might not be available - that's OK
      pinterestResults = [];
    }
  }

  // Search local collection
  let localResults: SearchResults["local"] = [];
  if (req.source !== "pinterest") {
    const whereClause = {
      analyzed: true,
      ...(req.collectionId ? { collectionId: req.collectionId } : {}),
      ...(req.imageId ? { NOT: { id: req.imageId } } : {}),
    };

    const allImages = await prisma.image.findMany({
      where: whereClause,
      select: {
        id: true,
        keywords: true,
        filepath: true,
        filename: true,
        description: true,
        mood: true,
        style: true,
      },
    });

    const parsedImages = allImages.map((img) => ({
      id: img.id,
      keywords: img.keywords ? JSON.parse(img.keywords) : [],
      filepath: img.filepath,
      filename: img.filename,
      description: img.description,
      mood: img.mood,
      style: img.style,
    }));

    // Use expanded keywords for better matching
    const allSearchKeywords = [
      ...new Set([...baseKeywords, ...expanded.expandedKeywords]),
    ];

    const ranked = findSimilarByKeywords(
      allSearchKeywords,
      parsedImages.map((img) => ({ id: img.id, keywords: img.keywords }))
    );

    // Map back to full data
    const imageMap = new Map(parsedImages.map((img) => [img.id, img]));
    localResults = ranked
      .filter((r) => r.score > 0)
      .slice(0, limit)
      .map((r) => {
        const img = imageMap.get(r.id)!;
        return {
          id: r.id,
          score: r.score,
          filepath: img.filepath,
          filename: img.filename,
          description: img.description,
          keywords: img.keywords,
          mood: img.mood,
          style: img.style,
        };
      });
  }

  return {
    keywords: baseKeywords,
    expandedKeywords: expanded.expandedKeywords,
    pinterestQuery: expanded.pinterestQuery,
    pinterest: pinterestResults,
    local: localResults,
  };
}

/**
 * Given an image and search results, use AI to rank which replacement
 * would be the best match based on visual similarity criteria.
 */
export async function rankReplacements(
  originalDescription: string,
  originalKeywords: string[],
  candidates: { id: string; description: string; keywords: string[] }[]
): Promise<{ id: string; rank: number; reason: string }[]> {
  if (candidates.length === 0) return [];

  const candidateList = candidates
    .map(
      (c, i) =>
        `${i + 1}. Keywords: ${c.keywords.join(", ")} | Description: ${c.description?.slice(0, 100) || "N/A"}`
    )
    .join("\n");

  const { text } = await generateText({
    model: getModel(),
    prompt: `I need to find the best replacement image for one described as:
Description: "${originalDescription}"
Keywords: ${originalKeywords.join(", ")}

Here are ${candidates.length} candidates:
${candidateList}

Rank the top 5 candidates by visual similarity. For each, explain briefly why it's a good match.
Format: one line per result as "RANK|CANDIDATE_NUMBER|REASON"`,
    temperature: 0.3,
    maxOutputTokens: 500,
  });

  const results: { id: string; rank: number; reason: string }[] = [];
  const lines = text.split("\n").filter((l) => l.includes("|"));

  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 3) {
      const rank = parseInt(parts[0]);
      const candidateIdx = parseInt(parts[1]) - 1;
      const reason = parts[2];
      if (!isNaN(rank) && candidateIdx >= 0 && candidateIdx < candidates.length) {
        results.push({ id: candidates[candidateIdx].id, rank, reason });
      }
    }
  }

  return results;
}
