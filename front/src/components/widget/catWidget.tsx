import React from 'react';
import { useScrap } from '@/hooks/useScrap';

const catImages = [
  '/cat1.jpg',
  '/cat2.jpg',
  '/cat3.jpg',
  '/cat4.jpg',
];
const catSayings = [
  '오늘도 냥냥~',
  '고양이는 사랑입니다.',
  '졸려...Zzz',
  '간식은 언제?',
];

export default function CatWidget() {
  const idx = Math.floor(Math.random() * catImages.length);
  
  // 스크랩 기능 추가
  const scrapContent = `${catSayings[idx]} - 고양이 위젯`;
  const { isScrapped, isLoading: scrapLoading, toggleScrap } = useScrap('widget', 'cat', scrapContent);

  return (
    <div className="bg-white rounded-lg p-4 flex flex-col items-center justify-center relative">
      {/* 스크랩 버튼 */}
      <div className="absolute top-2 right-2">
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

      <img src={catImages[idx]} alt="고양이" className="w-32 h-32 object-cover rounded-xl mb-2" />
      <div className="text-lg text-gray-700 font-semibold">{catSayings[idx]}</div>
    </div>
  );
} 