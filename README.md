# AI Writer - Headline & Image Tools

Two AI-powered tools for copywriters and marketers:

## 1. Headline Analyzer

Ingest thousands of URLs, scrape headlines/copy, analyze patterns with AI, and generate new headlines.

### API Endpoints

- **POST** `/api/headlines/ingest` - Bulk URL ingestion (2000+ URLs)
  ```json
  { "batchName": "My Batch", "urls": ["https://...", "https://..."] }
  ```
- **GET** `/api/headlines/ingest?batchId=xxx` - Check batch status
- **POST** `/api/headlines/analyze` - Run AI analysis on a completed batch
  ```json
  { "batchId": "xxx" }
  ```
- **GET** `/api/headlines/analyze?batchId=xxx` - Get analysis results
- **POST** `/api/headlines/generate` - Generate headlines using learned patterns
  ```json
  { "topic": "fitness for men over 40", "batchId": "xxx", "count": 15 }
  ```

## 2. Image Organizer

Upload and analyze 10,000+ images with AI vision, search Pinterest for replacements, create and iterate slideshows.

### API Endpoints

- **POST** `/api/images/upload` - Upload images (multipart/form-data)
- **GET** `/api/images/upload?collectionId=xxx` - List images in collection
- **POST** `/api/images/analyze` - Analyze images with AI vision
  ```json
  { "collectionId": "xxx" }
  ```
- **POST** `/api/images/search` - Search Pinterest + local collection
  ```json
  { "keywords": ["sunset", "beach"], "source": "both" }
  ```
- **POST** `/api/images/slideshows` - Create slideshow
  ```json
  { "collectionId": "xxx", "name": "My Slideshow", "imageIds": ["id1", "id2"] }
  ```
- **PUT** `/api/images/slideshows` - Create iteration with replacements
  ```json
  {
    "slideshowId": "xxx",
    "replacements": [{ "position": 0, "newImageId": "id", "source": "pinterest" }]
  }
  ```

## Setup

```bash
npm install
cp .env.example .env  # Configure your API keys
npx prisma migrate dev
npm run dev
```

## Stack

- Next.js 15 (App Router)
- Prisma + SQLite
- OpenAI GPT-4o-mini (text analysis + vision)
- Tailwind CSS
- Cheerio (HTML scraping)
