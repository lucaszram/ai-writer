"use client";

import { useState, useCallback } from "react";

interface Batch {
  id: string;
  name: string;
  status: string;
  totalUrls: number;
  processed: number;
  _count?: { headlines: number };
  headlineCount?: number;
}

interface Analysis {
  totalHeadlines: number;
  topPatterns: { pattern: string; count: number }[];
  topPowerWords: { word: string; count: number }[];
  sentimentDistribution: Record<string, number>;
  emotionDistribution: Record<string, number>;
  avgScore: number;
  insights: string;
}

export default function HeadlinesPage() {
  const [batchName, setBatchName] = useState("");
  const [urlsText, setUrlsText] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [generatedHeadlines, setGeneratedHeadlines] = useState<string[]>([]);
  const [generateTopic, setGenerateTopic] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const loadBatches = useCallback(async () => {
    const res = await fetch("/api/headlines/ingest");
    const data = await res.json();
    setBatches(data);
  }, []);

  const handleIngest = async () => {
    if (!batchName || !urlsText.trim()) {
      setError("Batch name and URLs are required");
      return;
    }

    setLoading("ingesting");
    setError("");

    const urls = urlsText
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    try {
      const res = await fetch("/api/headlines/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchName, urls }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSelectedBatch(data.batchId);
      setBatchName("");
      setUrlsText("");
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setLoading("");
    }
  };

  const handleAnalyze = async (batchId: string) => {
    setLoading("analyzing");
    setError("");
    try {
      const res = await fetch("/api/headlines/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAnalysis(data);
      setSelectedBatch(batchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading("");
    }
  };

  const handleGenerate = async () => {
    if (!generateTopic) return;

    setLoading("generating");
    setError("");
    try {
      const res = await fetch("/api/headlines/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: generateTopic,
          batchId: selectedBatch,
          count: 15,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setGeneratedHeadlines(data.headlines);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading("");
    }
  };

  const checkBatchStatus = async (batchId: string) => {
    const res = await fetch(`/api/headlines/ingest?batchId=${batchId}`);
    const data = await res.json();
    return data;
  };

  const pollBatch = async (batchId: string) => {
    setLoading("polling");
    const poll = async () => {
      const data = await checkBatchStatus(batchId);
      if (data.status === "completed") {
        setLoading("");
        await loadBatches();
      } else if (data.status === "failed") {
        setLoading("");
        setError("Batch processing failed");
      } else {
        setTimeout(poll, 3000);
      }
    };
    poll();
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold">Headline Analyzer</h2>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* URL Ingestion */}
      <section className="border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-xl font-semibold">1. Ingest URLs</h3>
        <p className="text-gray-400 text-sm">
          Paste up to thousands of URLs (one per line). Headlines, subheadlines, copy, and meta
          data will be scraped and analyzed.
        </p>
        <input
          type="text"
          value={batchName}
          onChange={(e) => setBatchName(e.target.value)}
          placeholder="Batch name (e.g. 'Fitness Headlines Q1')"
          className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
        />
        <textarea
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder={`Paste URLs here, one per line:\nhttps://example.com/article-1\nhttps://example.com/article-2\n...up to 3000+ URLs`}
          rows={10}
          className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 font-mono text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="flex items-center gap-4">
          <button
            onClick={handleIngest}
            disabled={loading === "ingesting"}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-6 py-2 rounded font-medium transition"
          >
            {loading === "ingesting" ? "Processing..." : "Ingest & Analyze"}
          </button>
          <span className="text-gray-500 text-sm">
            {urlsText.split("\n").filter((l) => l.trim()).length} URLs entered
          </span>
        </div>
      </section>

      {/* Batch List */}
      <section className="border border-gray-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">2. Batches</h3>
          <button
            onClick={loadBatches}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Refresh
          </button>
        </div>
        {batches.length === 0 ? (
          <p className="text-gray-500">
            No batches yet.{" "}
            <button onClick={loadBatches} className="text-blue-400 underline">
              Load batches
            </button>
          </p>
        ) : (
          <div className="space-y-2">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between bg-gray-900 px-4 py-3 rounded"
              >
                <div>
                  <span className="font-medium">{batch.name}</span>
                  <span className="text-gray-500 ml-2">
                    ({batch.totalUrls} URLs, {batch._count?.headlines || batch.headlineCount || 0}{" "}
                    headlines)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      batch.status === "completed"
                        ? "bg-green-900 text-green-300"
                        : batch.status === "processing"
                          ? "bg-yellow-900 text-yellow-300"
                          : batch.status === "failed"
                            ? "bg-red-900 text-red-300"
                            : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {batch.status}
                  </span>
                  {batch.status === "processing" && (
                    <button
                      onClick={() => pollBatch(batch.id)}
                      className="text-xs text-blue-400"
                    >
                      Poll status
                    </button>
                  )}
                  {batch.status === "completed" && (
                    <button
                      onClick={() => handleAnalyze(batch.id)}
                      disabled={loading === "analyzing"}
                      className="text-sm bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded"
                    >
                      {loading === "analyzing" ? "..." : "Analyze"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Analysis Results */}
      {analysis && (
        <section className="border border-gray-800 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-semibold">3. Analysis Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 p-4 rounded">
              <div className="text-2xl font-bold">{analysis.totalHeadlines}</div>
              <div className="text-gray-400 text-sm">Headlines Analyzed</div>
            </div>
            <div className="bg-gray-900 p-4 rounded">
              <div className="text-2xl font-bold">{analysis.avgScore.toFixed(1)}/10</div>
              <div className="text-gray-400 text-sm">Avg. Score</div>
            </div>
            <div className="bg-gray-900 p-4 rounded">
              <div className="text-2xl font-bold">
                {analysis.topPatterns[0]?.pattern || "N/A"}
              </div>
              <div className="text-gray-400 text-sm">Top Pattern</div>
            </div>
          </div>

          {/* Patterns */}
          <div>
            <h4 className="font-semibold mb-2">Top Patterns</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.topPatterns.map((p) => (
                <span
                  key={p.pattern}
                  className="bg-blue-900/50 text-blue-300 px-3 py-1 rounded text-sm"
                >
                  {p.pattern} ({p.count})
                </span>
              ))}
            </div>
          </div>

          {/* Power Words */}
          <div>
            <h4 className="font-semibold mb-2">Top Power Words</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.topPowerWords.slice(0, 15).map((w) => (
                <span
                  key={w.word}
                  className="bg-purple-900/50 text-purple-300 px-3 py-1 rounded text-sm"
                >
                  {w.word} ({w.count})
                </span>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div>
            <h4 className="font-semibold mb-2">AI Insights</h4>
            <div className="bg-gray-900 p-4 rounded whitespace-pre-wrap text-sm text-gray-300">
              {analysis.insights}
            </div>
          </div>
        </section>
      )}

      {/* Generate Headlines */}
      <section className="border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-xl font-semibold">4. Generate Headlines</h3>
        <p className="text-gray-400 text-sm">
          Generate new headlines based on learned patterns. Select a batch above to use its
          patterns as a reference.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={generateTopic}
            onChange={(e) => setGenerateTopic(e.target.value)}
            placeholder="Topic (e.g. 'weight loss supplements for women over 40')"
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleGenerate}
            disabled={loading === "generating" || !generateTopic}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 px-6 py-2 rounded font-medium transition"
          >
            {loading === "generating" ? "Generating..." : "Generate"}
          </button>
        </div>
        {selectedBatch && (
          <p className="text-xs text-gray-500">
            Using patterns from batch: {selectedBatch}
          </p>
        )}
        {generatedHeadlines.length > 0 && (
          <div className="space-y-2">
            {generatedHeadlines.map((h, i) => (
              <div key={i} className="bg-gray-900 px-4 py-3 rounded flex items-start gap-3">
                <span className="text-gray-600 font-mono text-sm mt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{h}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
