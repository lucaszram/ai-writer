/**
 * Pinterest search integration.
 *
 * This module provides the interface for searching Pinterest.
 * The actual Pinterest scraper/API is expected to be provided externally.
 *
 * Configure PINTEREST_API_URL in .env to point to your Pinterest search service.
 * Expected endpoint: GET {PINTEREST_API_URL}/search?q={keywords}&limit={limit}
 * Expected response: { results: [{ url, imageUrl, title, description }] }
 */

export interface PinterestResult {
  url: string;
  imageUrl: string;
  title: string;
  description: string;
}

export async function searchPinterest(
  keywords: string[],
  limit: number = 20
): Promise<PinterestResult[]> {
  const apiUrl = process.env.PINTEREST_API_URL;
  if (!apiUrl) {
    throw new Error(
      "PINTEREST_API_URL not configured. Set it in .env to point to your Pinterest search service."
    );
  }

  const query = keywords.join(" ");
  const url = `${apiUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Pinterest API returned ${response.status}`);
    }

    const data = await response.json();
    return (data.results || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => ({
        url: r.url || "",
        imageUrl: r.imageUrl || r.image_url || "",
        title: r.title || "",
        description: r.description || "",
      })
    );
  } catch (error) {
    console.error("Pinterest search failed:", error);
    throw error;
  }
}
