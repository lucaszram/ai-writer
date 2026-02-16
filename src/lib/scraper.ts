import * as cheerio from "cheerio";
import type { ScrapedHeadline } from "@/types";

export async function scrapeHeadline(url: string): Promise<ScrapedHeadline | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AIWriter/1.0; +https://example.com/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract headline from multiple sources, prioritized
    const h1 = $("h1").first().text().trim();
    const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || "";
    const metaTitle = $("title").text().trim();
    const twitterTitle = $('meta[name="twitter:title"]').attr("content")?.trim() || "";

    const headline = ogTitle || h1 || twitterTitle || metaTitle;
    if (!headline) return null;

    // Extract subheadline
    const subheadline =
      $("h2").first().text().trim() ||
      $('[class*="subtitle"]').first().text().trim() ||
      $('[class*="subhead"]').first().text().trim() ||
      undefined;

    // Extract copy/body text (first substantial paragraph)
    const paragraphs = $("article p, .content p, .post p, main p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((p) => p.length > 50);
    const copy = paragraphs.slice(0, 3).join("\n\n") || undefined;

    // Extract meta description
    const metaDesc =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      undefined;

    return {
      url,
      headline,
      subheadline,
      copy,
      metaTitle: metaTitle || undefined,
      metaDescription: metaDesc,
      ogTitle: ogTitle || undefined,
    };
  } catch {
    return null;
  }
}

export async function scrapeHeadlinesBatch(
  urls: string[],
  concurrency: number = 10,
  onProgress?: (processed: number, total: number) => void
): Promise<ScrapedHeadline[]> {
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(concurrency);
  const results: ScrapedHeadline[] = [];
  let processed = 0;

  const tasks = urls.map((url) =>
    limit(async () => {
      const result = await scrapeHeadline(url);
      processed++;
      onProgress?.(processed, urls.length);
      if (result) results.push(result);
    })
  );

  await Promise.all(tasks);
  return results;
}
