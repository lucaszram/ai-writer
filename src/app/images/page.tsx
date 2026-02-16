"use client";

import { useState, useCallback } from "react";

interface Collection {
  id: string;
  name: string;
  totalImages: number;
  _count?: { images: number };
}

interface ImageRecord {
  id: string;
  filename: string;
  filepath: string;
  description: string | null;
  keywords: string | null;
  mood: string | null;
  style: string | null;
  analyzed: boolean;
}

interface SlideshowRecord {
  id: string;
  name: string;
  version: number;
  parentId: string | null;
  _count?: { slots: number };
  slots?: { position: number; image: ImageRecord; originalImageId: string | null }[];
}

interface PinterestResult {
  url: string;
  imageUrl: string;
  title: string;
  description: string;
}

interface SearchResultData {
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

export default function ImagesPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [slideshows, setSlideshows] = useState<SlideshowRecord[]>([]);
  const [selectedSlideshow, setSelectedSlideshow] = useState<SlideshowRecord | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [slideshowName, setSlideshowName] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [analyzeStatus, setAnalyzeStatus] = useState<{
    total: number;
    analyzed: number;
  } | null>(null);

  const loadCollections = useCallback(async () => {
    const res = await fetch("/api/images/upload");
    const data = await res.json();
    setCollections(data);
  }, []);

  const loadCollection = async (collectionId: string) => {
    const res = await fetch(`/api/images/upload?collectionId=${collectionId}`);
    const data = await res.json();
    setImages(data.images || []);
    setSelectedCollection(collectionId);

    // Load analysis status
    const statusRes = await fetch(`/api/images/analyze?collectionId=${collectionId}`);
    const statusData = await statusRes.json();
    setAnalyzeStatus({ total: statusData.total, analyzed: statusData.analyzed });

    // Load slideshows
    const ssRes = await fetch(`/api/images/slideshows?collectionId=${collectionId}`);
    const ssData = await ssRes.json();
    setSlideshows(ssData);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading("uploading");
    setError("");

    const formData = new FormData();
    if (selectedCollection) {
      formData.append("collectionId", selectedCollection);
    } else {
      formData.append("collectionName", collectionName || `Collection ${Date.now()}`);
    }
    for (const file of Array.from(files)) {
      formData.append("images", file);
    }

    try {
      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.collectionId) {
        await loadCollection(data.collectionId);
        await loadCollections();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading("");
    }
  };

  const handleAnalyzeAll = async () => {
    if (!selectedCollection) return;

    setLoading("analyzing");
    setError("");

    try {
      const res = await fetch("/api/images/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId: selectedCollection }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Poll for completion
      pollAnalysis(selectedCollection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setLoading("");
    }
  };

  const pollAnalysis = async (collectionId: string) => {
    const poll = async () => {
      const res = await fetch(`/api/images/analyze?collectionId=${collectionId}`);
      const data = await res.json();
      setAnalyzeStatus({ total: data.total, analyzed: data.analyzed });

      if (data.analyzed < data.total) {
        setTimeout(poll, 5000);
      } else {
        setLoading("");
        await loadCollection(collectionId);
      }
    };
    poll();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading("searching");
    setError("");

    try {
      // AI interprets the query - can be keywords or natural language
      const res = await fetch("/api/images/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          source: "both",
          collectionId: selectedCollection || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSearchResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading("");
    }
  };

  const handleSearchByImage = async (imageId: string) => {
    setLoading("searching");
    setError("");

    try {
      const res = await fetch("/api/images/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId,
          source: "both",
          collectionId: selectedCollection || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSearchResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading("");
    }
  };

  const handleCreateSlideshow = async () => {
    if (!selectedCollection || !slideshowName || images.length === 0) return;

    setLoading("creating-slideshow");
    setError("");

    try {
      const imageIds = images.map((img) => img.id);
      const res = await fetch("/api/images/slideshows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId: selectedCollection,
          name: slideshowName,
          imageIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSelectedSlideshow(data);
      setSlideshowName("");
      await loadCollection(selectedCollection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create slideshow");
    } finally {
      setLoading("");
    }
  };

  const loadSlideshow = async (slideshowId: string) => {
    const res = await fetch(`/api/images/slideshows?id=${slideshowId}`);
    const data = await res.json();
    setSelectedSlideshow(data);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold">Image Organizer</h2>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Upload Section */}
      <section className="border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-xl font-semibold">1. Upload Images</h3>
        <div className="flex items-center gap-4">
          {!selectedCollection && (
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Collection name"
              className="bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
            />
          )}
          <label className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium transition cursor-pointer">
            {loading === "uploading" ? "Uploading..." : "Upload Images"}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              className="hidden"
              disabled={loading === "uploading"}
            />
          </label>
          <button onClick={loadCollections} className="text-sm text-blue-400 hover:text-blue-300">
            Load Collections
          </button>
        </div>

        {/* Collections list */}
        {collections.length > 0 && (
          <div className="space-y-2">
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => loadCollection(col.id)}
                className={`w-full text-left px-4 py-3 rounded transition ${
                  selectedCollection === col.id
                    ? "bg-blue-900/50 border border-blue-700"
                    : "bg-gray-900 hover:bg-gray-800"
                }`}
              >
                <span className="font-medium">{col.name}</span>
                <span className="text-gray-500 ml-2">
                  ({col.totalImages || col._count?.images || 0} images)
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Image Analysis */}
      {selectedCollection && (
        <section className="border border-gray-800 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">2. Analyze Images (AI Vision)</h3>
            {analyzeStatus && (
              <span className="text-sm text-gray-400">
                {analyzeStatus.analyzed}/{analyzeStatus.total} analyzed
              </span>
            )}
          </div>
          <button
            onClick={handleAnalyzeAll}
            disabled={loading === "analyzing"}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 px-6 py-2 rounded font-medium transition"
          >
            {loading === "analyzing" ? "Analyzing..." : "Analyze All Unanalyzed"}
          </button>

          {/* Image grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {images.slice(0, 60).map((img) => (
              <div
                key={img.id}
                className="relative bg-gray-900 rounded overflow-hidden group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.filepath}
                  alt={img.description || img.filename}
                  className="w-full h-24 object-cover"
                />
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition p-2 text-xs overflow-auto">
                  {img.analyzed ? (
                    <>
                      <p className="text-white mb-1">{img.description?.slice(0, 80)}</p>
                      <p className="text-blue-300">
                        {img.keywords
                          ? JSON.parse(img.keywords).slice(0, 5).join(", ")
                          : ""}
                      </p>
                      <p className="text-purple-300">{img.mood}</p>
                      <button
                        onClick={() => handleSearchByImage(img.id)}
                        className="mt-1 text-green-400 underline"
                      >
                        Find similar
                      </button>
                    </>
                  ) : (
                    <p className="text-gray-400">Not analyzed</p>
                  )}
                </div>
                {img.analyzed && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
                )}
              </div>
            ))}
          </div>
          {images.length > 60 && (
            <p className="text-gray-500 text-sm">
              Showing 60 of {images.length} images
            </p>
          )}
        </section>
      )}

      {/* AI Search */}
      <section className="border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-xl font-semibold">3. AI Image Search</h3>
        <p className="text-gray-400 text-sm">
          Search with natural language or keywords. AI expands your query and searches
          both Pinterest and your local collection.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. 'sunset on a tropical beach with palm trees' or 'fitness, gym, motivation'"
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading === "searching"}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 px-6 py-2 rounded font-medium transition"
          >
            {loading === "searching" ? "Searching..." : "Search"}
          </button>
        </div>

        {searchResults && (
          <div className="space-y-4">
            {/* AI-expanded keywords */}
            <div className="bg-gray-900 p-3 rounded">
              <p className="text-xs text-gray-500 mb-1">
                Pinterest query: <span className="text-red-400">{searchResults.pinterestQuery}</span>
              </p>
              <div className="flex flex-wrap gap-1">
                {searchResults.expandedKeywords.slice(0, 20).map((kw) => (
                  <span
                    key={kw}
                    className={`text-xs px-2 py-0.5 rounded ${
                      searchResults.keywords.includes(kw)
                        ? "bg-blue-900 text-blue-300"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            {/* Pinterest results */}
            {searchResults.pinterest.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">
                  Pinterest ({searchResults.pinterest.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {searchResults.pinterest.map((pin, i) => (
                    <a
                      key={i}
                      href={pin.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-900 rounded overflow-hidden hover:ring-2 ring-red-500 transition"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pin.imageUrl}
                        alt={pin.title}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-2">
                        <p className="text-xs truncate">{pin.title}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Local collection results */}
            {searchResults.local.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">
                  From Collection ({searchResults.local.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {searchResults.local.map((img) => (
                    <div key={img.id} className="bg-gray-900 rounded overflow-hidden group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.filepath}
                        alt={img.description || img.filename}
                        className="w-full h-28 object-cover"
                      />
                      <div className="p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-green-400 font-mono">
                            {(img.score * 100).toFixed(0)}% match
                          </span>
                          {img.mood && (
                            <span className="text-xs text-purple-400">{img.mood}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {img.description?.slice(0, 80)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.pinterest.length === 0 && searchResults.local.length === 0 && (
              <p className="text-gray-500 text-center py-4">No results found</p>
            )}
          </div>
        )}
      </section>

      {/* Slideshows */}
      {selectedCollection && (
        <section className="border border-gray-800 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-semibold">4. Slideshows</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={slideshowName}
              onChange={(e) => setSlideshowName(e.target.value)}
              placeholder="Slideshow name"
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCreateSlideshow}
              disabled={loading === "creating-slideshow" || !slideshowName}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 px-6 py-2 rounded font-medium transition"
            >
              Create from All Images
            </button>
          </div>

          {/* Slideshow list */}
          {slideshows.length > 0 && (
            <div className="space-y-2">
              {slideshows.map((ss) => (
                <button
                  key={ss.id}
                  onClick={() => loadSlideshow(ss.id)}
                  className={`w-full text-left px-4 py-3 rounded transition ${
                    selectedSlideshow?.id === ss.id
                      ? "bg-green-900/50 border border-green-700"
                      : "bg-gray-900 hover:bg-gray-800"
                  }`}
                >
                  <span className="font-medium">{ss.name}</span>
                  <span className="text-gray-500 ml-2">
                    (v{ss.version}, {ss._count?.slots || 0} slots)
                  </span>
                  {ss.parentId && (
                    <span className="text-yellow-500 text-xs ml-2">iteration</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Slideshow viewer */}
          {selectedSlideshow && selectedSlideshow.slots && (
            <div>
              <h4 className="font-semibold mb-2">
                {selectedSlideshow.name} - {selectedSlideshow.slots.length} slides
              </h4>
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2">
                {selectedSlideshow.slots.map((slot) => (
                  <div
                    key={slot.position}
                    className={`relative rounded overflow-hidden ${
                      slot.originalImageId
                        ? "ring-2 ring-yellow-500"
                        : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slot.image.filepath}
                      alt=""
                      className="w-full h-16 object-cover"
                    />
                    <div className="absolute bottom-0 left-0 bg-black/60 text-[10px] px-1">
                      {slot.position + 1}
                    </div>
                    {slot.originalImageId && (
                      <div className="absolute top-0 right-0 bg-yellow-600 text-[10px] px-1">
                        replaced
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
