-- CreateTable
CREATE TABLE "HeadlineBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalUrls" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Headline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT,
    "copy" TEXT,
    "metaTitle" TEXT,
    "metaDesc" TEXT,
    "ogTitle" TEXT,
    "sentiment" TEXT,
    "emotion" TEXT,
    "powerWords" TEXT,
    "structure" TEXT,
    "score" REAL,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Headline_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HeadlineBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HeadlineAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "totalHeadlines" INTEGER NOT NULL,
    "topPatterns" TEXT NOT NULL,
    "topPowerWords" TEXT NOT NULL,
    "sentimentDist" TEXT NOT NULL,
    "emotionDist" TEXT NOT NULL,
    "avgScore" REAL NOT NULL,
    "insights" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ImageCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalImages" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "description" TEXT,
    "keywords" TEXT,
    "colors" TEXT,
    "objects" TEXT,
    "mood" TEXT,
    "style" TEXT,
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Image_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ImageCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Slideshow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Slideshow_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ImageCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SlideshowSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slideshowId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "imageId" TEXT NOT NULL,
    "originalImageId" TEXT,
    "replacementSource" TEXT,
    "pinterestUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SlideshowSlot_slideshowId_fkey" FOREIGN KEY ("slideshowId") REFERENCES "Slideshow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SlideshowSlot_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Headline_batchId_idx" ON "Headline"("batchId");

-- CreateIndex
CREATE INDEX "Headline_structure_idx" ON "Headline"("structure");

-- CreateIndex
CREATE UNIQUE INDEX "HeadlineAnalysis_batchId_key" ON "HeadlineAnalysis"("batchId");

-- CreateIndex
CREATE INDEX "Image_collectionId_idx" ON "Image"("collectionId");

-- CreateIndex
CREATE INDEX "Image_analyzed_idx" ON "Image"("analyzed");

-- CreateIndex
CREATE INDEX "Slideshow_collectionId_idx" ON "Slideshow"("collectionId");

-- CreateIndex
CREATE INDEX "Slideshow_parentId_idx" ON "Slideshow"("parentId");

-- CreateIndex
CREATE INDEX "SlideshowSlot_slideshowId_idx" ON "SlideshowSlot"("slideshowId");

-- CreateIndex
CREATE UNIQUE INDEX "SlideshowSlot_slideshowId_position_key" ON "SlideshowSlot"("slideshowId", "position");
