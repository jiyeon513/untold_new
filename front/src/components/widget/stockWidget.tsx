import React from 'react';
import { useScrap } from '@/hooks/useScrap';

const stocks = [
  { symbol: 'AAPL', name: 'Apple', price: 192.32, change: +1.23 },
  { symbol: 'TSLA', name: 'Tesla', price: 254.12, change: -2.11 },
  { symbol: 'GOOGL', name: 'Google', price: 134.56, change: +0.87 },
  { symbol: 'NVDA', name: 'NVIDIA', price: 456.78, change: +3.45 },
];

export default function StockWidget() {
  // 스크랩 기능 추가
  const scrapContent = stocks.length > 0 ? 
    `${stocks[0].symbol} (${stocks[0].name}): $${stocks[0].price.toFixed(2)}` : '';
  const { isScrapped, isLoading: scrapLoading, toggleScrap } = useScrap('widget', 'stock', scrapContent);

  return (
    <div className="bg-white rounded-lg p-4">
      {/* 스크랩 버튼 */}
      <div className="flex justify-end mb-2">
        <button
          onClick={toggleScrap}
          disabled={scrapLoading}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
            isScrapped 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
          } ${scrapLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {scrapLoading ? '처리중...' : isScrapped ? '스크랩됨' : '스크랩하기'}
        </button>
      </div>

      <div className="font-bold text-gray-800 mb-2">오늘의 주식</div>
      <div className="space-y-2">
        {stocks.map(stock => (
          <div key={stock.symbol} className="flex items-center gap-2">
            <span className="font-mono text-blue-600 w-14">{stock.symbol}</span>
            <span className="flex-1 truncate">{stock.name}</span>
            <span className="font-semibold">${stock.price.toFixed(2)}</span>
            <span className={stock.change >= 0 ? 'text-green-600' : 'text-red-500'}>
              {stock.change >= 0 ? '+' : ''}{stock.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
} 