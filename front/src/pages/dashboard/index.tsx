import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Navigation from '@/components/Navigation';
import { useRouter } from 'next/router';
import Masonry from 'react-masonry-css';
import { supabase } from '@/api/supabaseClient'; // Supabase 클라이언트 import
import axios from 'axios'; // API 호출을 위해 axios 사용

import RandomDogWidget from '../../components/widget/randomdogWidget';
import AdviceWidget from '../../components/widget/adviceWidget';
import BookWidget from '../../components/widget/bookWidget';
import WeatherWidget from '../../components/widget/weatherWidget';
import NewsWidget from '../../components/widget/newsWidget';
import CatWidget from '../../components/widget/catWidget';
import MusicWidget from '../../components/widget/musicWidget';
import StockWidget from '../../components/widget/stockWidget';
import NasaWidget from '../../components/widget/nasaWidget';

interface Widget {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  isInstalled: boolean;
}

export default function Dashboard() {
  const [installedWidgets, setInstalledWidgets] = useState<string[]>([]);
  const router = useRouter();

  // localStorage에서 설치된 위젯 불러오기
  useEffect(() => {
    const fetchUserWidgets = async () => {
      // 1. 현재 로그인한 사용자 세션을 가져옵니다.
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // 2. 세션이 있으면, 백엔드 API를 호출하여 DB에서 위젯 목록을 가져옵니다.
        try {
          const response = await axios.get(`/api/widgets/user/${session.user.id}`);
          // DB에서 widget_name만 추출하여 state에 저장합니다.
          const fetchedWidgets = response.data.map((w: any) => w.widget_name);
          setInstalledWidgets(fetchedWidgets);
        } catch (error) {
          console.error("사용자 위젯 정보를 불러오는데 실패했습니다:", error);
        }
      } else {
        // 3. 세션이 없으면 로그인 페이지로 이동시킵니다.
        router.push('/');
      }
    };

    fetchUserWidgets();
  }, [router]); // 의존성 배열에 router 추가

  // 위젯 데이터
  const widgetData = {
    'random-dog': {
      name: '랜덤 강아지',
      icon: '🐶',
      component: RandomDogWidget,
      category: 'entertainment'
    },
    'cat': {
      name: '랜덤 고양이',
      icon: '🐱',
      component: CatWidget,
      category: 'entertainment'
    },
    'advice': {
      name: '명언',
      icon: '💭',
      component: AdviceWidget,
      category: 'inspiration'
    },
    'music': {
      name: '음악 추천',
      icon: '🎵',
      component: MusicWidget,
      category: 'entertainment'
    },
    'book': {
      name: '주목할 만한 신간',
      icon: '📚',
      component: BookWidget,
      category: 'culture'
    },
    'weather': {
      name: '실시간 날씨',
      icon: '🌤️',
      component: WeatherWidget,
      category: 'information'
    },
    'stock': {
      name: '오늘의 주식',
      icon: '💹',
      component: StockWidget,
      category: 'information'
    },
    'news': {
      name: '오늘의 미국 뉴스',
      icon: '📰',
      component: NewsWidget,
      category: 'news'
    },
    'nasa': {
      name: 'NASA 오늘의 우주',
      icon: '🚀',
      component: NasaWidget,
      category: 'information'
    }
  };

  const handleAddWidget = () => {
    router.push('/widget-store');
  };

  // 현재 시간과 날짜
  const now = new Date();
  const timeString = now.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  const dateString = now.toLocaleDateString('ko-KR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });

  // Masonry breakpoints
  const breakpointColumnsObj = {
    default: 3,
    1100: 2,
    700: 1
  };

  return (
    <>
      <Head>
        <title>대시보드 - Untold</title>
        <meta name="description" content="아침 대시보드 - 정보와 감정 추천" />
      </Head>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* 헤더 섹션 - 전체 너비 */}
        <header className="w-full bg-white/70 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-8 py-6">
            <div className="flex items-center justify-between">
              {/* 왼쪽: 제목과 날짜 */}
              <div className="flex items-center space-x-8">
                <div>
                  <h1 className="text-4xl font-bold text-gray-800">🌅 아침 대시보드</h1>
                  <p className="text-gray-600 text-lg mt-1">{dateString}</p>
                </div>
                

              </div>

              {/* 오른쪽: 시간과 인사말 */}
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-800 mb-1">{timeString}</div>
                <p className="text-gray-500 text-lg">좋은 하루 되세요!</p>
              </div>
            </div>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        {installedWidgets.length > 0 ? (
          <div className="max-w-7xl mx-auto p-6">
            <Masonry
              breakpointCols={breakpointColumnsObj}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {/* 위젯들을 순서대로 배치 */}
              {installedWidgets.map(widgetId => {
                const widget = widgetData[widgetId as keyof typeof widgetData];
                if (!widget) return null;
                
                return (
                  <div key={widgetId} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 mb-6">
                    <div className="flex items-center mb-4">
                      <span className="text-3xl mr-3">{widget.icon}</span>
                      <h3 className="text-xl font-semibold text-gray-800">{widget.name}</h3>
                    </div>
                    <widget.component />
                  </div>
                );
              })}

              {/* 위젯 추가 카드 - 항상 마지막에 표시 */}
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-2xl border border-blue-200/30 p-6 flex flex-col justify-center items-center mb-6">
                <div className="text-center">
                  <div className="text-4xl mb-4">✨</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">위젯 추가</h3>
                  <p className="text-gray-600 text-lg mb-6">더 많은 위젯으로 대시보드를 꾸며보세요</p>
                  <button 
                    onClick={handleAddWidget}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors text-lg"
                  >
                    위젯 스토어 가기
                  </button>
                </div>
              </div>
            </Masonry>
          </div>
        ) : (
          /* 빈 상태 */
          <div className="max-w-7xl mx-auto flex items-center justify-center min-h-96 p-6">
            <div className="text-center">
              <div className="text-8xl mb-8">✨</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6">위젯을 추가해보세요!</h2>
              <p className="text-gray-600 text-lg mb-10 max-w-lg">
                대시보드에 표시할 위젯을 선택하여 개인화된 대시보드를 만들어보세요.
              </p>
              <button 
                onClick={handleAddWidget}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
              >
                🛍️ 위젯 스토어 가기
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
} 