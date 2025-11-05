import React from 'react';
import { useScrap } from '@/hooks/useScrap';

const musicList = [
  {
    title: 'Butterfly',
    artist: 'BTS',
    url: 'https://www.youtube.com/watch?v=2cTZTqBU1Rc',
  },
  {
    title: '밤편지',
    artist: '아이유',
    url: 'https://www.youtube.com/watch?v=BzYnNdJhZQw',
  },
  {
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    url: 'https://www.youtube.com/watch?v=JGwWNGJdvx8',
  },
  {
    title: 'Dynamite',
    artist: 'BTS',
    url: 'https://www.youtube.com/watch?v=gdZLi9oWNZg',
  },
  {
    title: 'Permission to Dance',
    artist: 'BTS',
    url: 'https://www.youtube.com/watch?v=CuklIb9d3fI',
  },
];

export default function MusicWidget() {
  // 3개 랜덤 추출
  const shuffled = [...musicList].sort(() => 0.5 - Math.random());
  const showList = shuffled.slice(0, 3);
  
  // 스크랩 기능 추가
  const scrapContent = showList.length > 0 ? 
    `${showList[0].title} - ${showList[0].artist}` : '';
  const { isScrapped, isLoading: scrapLoading, toggleScrap } = useScrap('widget', 'music', scrapContent);

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

      <div className="space-y-2">
        {showList.map((music, idx) => (
          <div key={music.title} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-800 truncate">{idx+1}. {music.title}</div>
              <div className="text-sm text-gray-500 truncate">{music.artist}</div>
            </div>
            <a href={music.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs ml-2 hover:underline">듣기</a>
          </div>
        ))}
      </div>
    </div>
  );
} 