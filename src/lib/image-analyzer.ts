import { generateObject } from "ai";
import { z } from "zod";
import { getVisionModel } from "./openai";
import type { ImageAnalysisResult } from "@/types";
import * as fs from "fs";
import * as path from "path";

// Zod schema for structured image analysis
const imageAnalysisSchema = z.object({
  description: z
    .string()
    .describe("A detailed description of the image content, scene, and composition"),
  keywords: z
    .array(z.string())
    .describe("15-25 searchable keywords for finding similar images on Pinterest or stock sites"),
  colors: z.array(z.string()).describe("Dominant colors in the image"),
  objects: z.array(z.string()).describe("All identifiable objects and elements in the image"),
  mood: z
    .string()
    .describe(
      "The overall mood/feeling: energetic, calm, dramatic, warm, cold, professional, playful, etc."
    ),
  style: z
    .string()
    .describe(
      "The visual style: photography, illustration, flat-design, 3d-render, minimalist, vintage, etc."
    ),
});

export async function analyzeImage(imagePath: string): Promise<ImageAnalysisResult> {
  const absolutePath = path.resolve(imagePath);
  const imageBuffer = fs.readFileSync(absolutePath);
  const base64 = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase().replace(".", "");
  const mimeType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  const { object } = await generateObject({
    model: getVisionModel(),
    schema: imageAnalysisSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this image in detail. Extract keywords that would be useful for searching similar images on Pinterest or stock photo sites.",
          },
          {
            type: "image",
            image: `data:${mimeType};base64,${base64}`,
          },
        ],
      },
    ],
    temperature: 0.3,
  });

  return object;
}

export async function analyzeImageFromUrl(imageUrl: string): Promise<ImageAnalysisResult> {
  const { object } = await generateObject({
    model: getVisionModel(),
    schema: imageAnalysisSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this image in detail. Extract keywords that would be useful for searching similar images on Pinterest or stock photo sites.",
          },
          {
            type: "image",
            image: new URL(imageUrl),
          },
        ],
      },
    ],
    temperature: 0.3,
  });

  return object;
}

export function findSimilarByKeywords(
  targetKeywords: string[],
  allImages: { id: string; keywords: string[] }[]
): { id: string; score: number }[] {
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
