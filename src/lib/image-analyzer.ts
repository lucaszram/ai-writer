import { getOpenAI } from "./openai";
import type { ImageAnalysisResult } from "@/types";
import * as fs from "fs";
import * as path from "path";

export async function analyzeImage(imagePath: string): Promise<ImageAnalysisResult> {
  const absolutePath = path.resolve(imagePath);
  const imageBuffer = fs.readFileSync(absolutePath);
  const base64 = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase().replace(".", "");
  const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this image in detail. Respond in JSON with exactly these fields:
{
  "description": "A detailed description of the image content, scene, and composition",
  "keywords": ["keyword1", "keyword2", ...] (15-25 searchable keywords for finding similar images),
  "colors": ["color1", "color2", ...] (dominant colors),
  "objects": ["object1", "object2", ...] (all identifiable objects/elements),
  "mood": "the overall mood/feeling (e.g. energetic, calm, dramatic, warm, cold, professional, playful)",
  "style": "the visual style (e.g. photography, illustration, flat-design, 3d-render, minimalist, vintage)"
}`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: "low",
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 800,
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    description: result.description || "",
    keywords: result.keywords || [],
    colors: result.colors || [],
    objects: result.objects || [],
    mood: result.mood || "neutral",
    style: result.style || "photography",
  };
}

export async function analyzeImageFromUrl(imageUrl: string): Promise<ImageAnalysisResult> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this image in detail. Respond in JSON with exactly these fields:
{
  "description": "A detailed description of the image content, scene, and composition",
  "keywords": ["keyword1", "keyword2", ...] (15-25 searchable keywords for finding similar images),
  "colors": ["color1", "color2", ...] (dominant colors),
  "objects": ["object1", "object2", ...] (all identifiable objects/elements),
  "mood": "the overall mood/feeling (e.g. energetic, calm, dramatic, warm, cold, professional, playful)",
  "style": "the visual style (e.g. photography, illustration, flat-design, 3d-render, minimalist, vintage)"
}`,
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "low",
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 800,
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    description: result.description || "",
    keywords: result.keywords || [],
    colors: result.colors || [],
    objects: result.objects || [],
    mood: result.mood || "neutral",
    style: result.style || "photography",
  };
}

export async function findSimilarByKeywords(
  targetKeywords: string[],
  allImages: { id: string; keywords: string[] }[]
): Promise<{ id: string; score: number }[]> {
  const targetSet = new Set(targetKeywords.map((k) => k.toLowerCase()));

  const scored = allImages.map((img) => {
    const imgKeywords = new Set(img.keywords.map((k) => k.toLowerCase()));
    const intersection = [...targetSet].filter((k) => imgKeywords.has(k));
    const union = new Set([...targetSet, ...imgKeywords]);
    const score = union.size > 0 ? intersection.length / union.size : 0;
    return { id: img.id, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}
