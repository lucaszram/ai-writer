export default function Home() {
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold">AI Writer Tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <a
          href="/headlines"
          className="block p-6 border border-gray-800 rounded-lg hover:border-blue-500 transition"
        >
          <h3 className="text-xl font-semibold mb-2">Headline Analyzer</h3>
          <p className="text-gray-400">
            Ingest thousands of URLs, analyze headline patterns, and generate
            high-performing headlines and copy using AI.
          </p>
        </a>
        <a
          href="/images"
          className="block p-6 border border-gray-800 rounded-lg hover:border-blue-500 transition"
        >
          <h3 className="text-xl font-semibold mb-2">Image Organizer</h3>
          <p className="text-gray-400">
            Analyze images with AI vision, organize slideshows of 10,000+
            images, search Pinterest for replacements, and generate iterations.
          </p>
        </a>
      </div>
    </div>
  );
}
