'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import aiApi from '@/lib/aiApi';

interface AiSummaryProps {
  content: string;
  title: string;
  type: 'product' | 'article' | 'solution' | 'case';
}

export default function AiSummary({ content, title, type }: AiSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateSummary = async () => {
    setLoading(true);
    try {
      const prompt = `请为以下${type === 'product' ? '产品' : type === 'article' ? '文章' : type === 'solution' ? '解决方案' : '案例'}生成一段简洁的AI摘要（100字以内）：\n\n标题：${title}\n\n内容：${content.substring(0, 500)}`;
      
      const response = await aiApi.post('/chat', {
        user_input: prompt,
      });

      const data = (response as any).data || response;
      setSummary(data.content || data.message || '暂无摘要');
    } catch (error) {
      setSummary('暂时无法生成摘要，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-black" />
          <h3 className="font-semibold text-black text-sm">AI 智能摘要</h3>
        </div>
        <button
          onClick={generateSummary}
          disabled={loading}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {summary ? (
        <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
      ) : (
        <button
          onClick={generateSummary}
          disabled={loading}
          className="text-sm text-gray-500 hover:text-black transition-colors disabled:opacity-50"
        >
          {loading ? '生成中...' : '点击生成AI摘要'}
        </button>
      )}
    </div>
  );
}
