// front/src/components/widget/randomdogWidget.tsx

import React, { useState, useEffect } from 'react';
import { useScrap } from '@/hooks/useScrap';

export default function RandomDogWidget() {
  const [dogImageUrl, setDogImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 스크랩 기능 추가
  const scrapContent = dogImageUrl ? `강아지 이미지: ${dogImageUrl}` : '';
  const { isScrapped, isLoading: scrapLoading, toggleScrap } = useScrap('widget', 'randomdog', scrapContent);

  useEffect(() => {
    const fetchDogImage = async () => {
      setIsLoading(true);
      try {
        // Dog API 직접 호출 (백엔드 없이)
        const response = await fetch('https://dog.ceo/api/breeds/image/random');
        const data = await response.json();
        
        if (data.status === 'success') {
          setDogImageUrl(data.message);
        } else {
          console.error('강아지 이미지를 가져올 수 없습니다.');
        }
      } catch (error) {
        console.error('강아지 이미지 로딩 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDogImage();
  }, []);

  return (
    <div className="bg-white rounded-lg h-48 flex flex-col">
      {/* 스크랩 버튼 - 상단에 별도 영역 */}
      {!isLoading && dogImageUrl && (
        <div className="flex justify-end p-2">
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
      )}

      {/* 이미지 영역 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {isLoading ? (
          <div className="text-gray-500">🐕</div>
        ) : dogImageUrl ? (
          <img 
            src={dogImageUrl} 
            alt="Random Dog" 
            className="w-full h-full object-contain" 
          />
        ) : (
          <div className="text-gray-500">🐕</div>
        )}
      </div>
    </div>
  );
}