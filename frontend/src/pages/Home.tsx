import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

export default function Home() {
  const [health, setHealth] = useState<{ status?: string; database?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/health")
      .then((res) => setHealth(res.data))
      .catch((err) => setError(err.message || "请求失败"));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-medium text-gray-800">欢迎</h2>
      <p className="text-gray-600">这是类 ChatGPT 对话系统的主界面。Phase 2 将实现核心对话功能。</p>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 font-medium text-gray-700">API 健康检查</h3>
        {error && <p className="text-red-500">{error}</p>}
        {health && (
          <pre className="overflow-auto rounded bg-gray-100 p-2 text-sm">
            {JSON.stringify(health, null, 2)}
          </pre>
        )}
        {!health && !error && <p className="text-gray-500">检查中...</p>}
      </div>
    </div>
  );
}
