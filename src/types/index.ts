// Headline types
export interface HeadlineIngestRequest {
  batchName: string;
  urls: string[];
}

export interface HeadlineIngestResponse {
  batchId: string;
  totalUrls: number;
  status: string;
}

export interface ScrapedHeadline {
  url: string;
  headline: string;
  subheadline?: string;
  copy?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
}

export interface HeadlineAnalysisResult {
  sentiment: string;
  emotion: string;
  powerWords: string[];
  structure: string;
  score: number;
  tags: string[];
}

export interface BatchAnalysisResult {
  totalHeadlines: number;
  topPatterns: { pattern: string; count: number }[];
  topPowerWords: { word: string; count: number }[];
  sentimentDistribution: Record<string, number>;
  emotionDistribution: Record<string, number>;
  avgScore: number;
  insights: string;
}

export interface GenerateHeadlinesRequest {
  topic: string;
  style?: string;
  count?: number;
  batchId?: string; // Use patterns from this batch
}

// Image types
export interface ImageAnalysisResult {
  description: string;
  keywords: string[];
  colors: string[];
  objects: string[];
  mood: string;
  style: string;
}

export interface PinterestSearchRequest {
  keywords: string[];
  imageId?: string; // reference image
}

export interface SlideshowCreateRequest {
  collectionId: string;
  name: string;
  imageIds: string[];
}

export interface SlideshowIterationRequest {
  slideshowId: string;
  slotsToReplace: {
    position: number;
    strategy: "pinterest" | "similar" | "keyword";
    keywords?: string[];
  }[];
}
