export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">CoinFlip Event API</h1>
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold mb-2">API Endpoints</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  GET /api/flips/recent
                </code>
                <span className="ml-2">- Get last 20 completed flips</span>
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  GET /api/flips/user/[address]
                </code>
                <span className="ml-2">- Get all flips for a specific user</span>
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  GET /api/stats
                </code>
                <span className="ml-2">- Get contract balance and total volume statistics</span>
              </li>
            </ul>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                API running on: <code className="bg-gray-100 px-2 py-1 rounded">http://localhost:3090</code>
              </p>
            </div>
          </div>
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-2">Event Listener</h3>
            <p className="text-gray-600">
              Run the event listener with: <code className="bg-gray-100 px-2 py-1 rounded">npm run listener</code>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

