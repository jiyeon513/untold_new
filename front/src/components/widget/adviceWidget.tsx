// front/src/components/widget/adviceWidget.tsx

import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useScrap } from '@/hooks/useScrap';

// API 응답 데이터 타입을 새로운 형식에 맞게 수정
interface AdviceData {
  message: string;
  author: string;
}

export default function AdviceWidget() {
  const [advice, setAdvice] = useState<AdviceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 스크랩 기능 추가
  const scrapContent = advice ? `"${advice.message}" - ${advice.author}` : '';
  const { isScrapped, isLoading: scrapLoading, toggleScrap } = useScrap('widget', 'advice', scrapContent);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await axiosInstance.get('/api/widgets/advice');
        setAdvice(response.data);
      } catch (error) {
        console.error('명언 데이터를 가져오는 데 실패했습니다:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      {isLoading ? (
        <p className="text-gray-500">명언을 불러오는 중...</p>
      ) : advice ? (
        <div>
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

          {/* content를 message로 변경 */}
          <blockquote className="italic text-gray-700 mb-3">
            "{advice.message}"
          </blockquote>
          <p className="text-sm text-gray-500 text-right">- {advice.author}</p>
        </div>
      ) : (
        <p className="text-gray-500">명언을 불러올 수 없어요.</p>
      )}
    </>
  );
}