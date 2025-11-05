import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Navigation from '@/components/Navigation';

import { supabase } from '@/api/supabaseClient'; // Supabase 클라이언트 import
import axios from 'axios'; // API 호출을 위해 axios 사용

interface Widget {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  isInstalled: boolean;
  color: string;
  features: string[];
}

export default function WidgetStore() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [hoveredWidget, setHoveredWidget] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // 초기 위젯 데이터
  const initialWidgets: Widget[] = [
    {
      id: 'random-dog',
      name: '랜덤 강아지',
      description: '매일 새로운 귀여운 강아지 사진으로 하루를 시작하세요',
      icon: '🐶',
      category: 'entertainment',
      isInstalled: false,
      color: 'from-rose-200 to-pink-300',
      features: ['랜덤한 새로운 강아지', '귀여움 충전', '즐거운 하루 시작']
    },
    {
      id: 'cat',
      name: '랜덤 고양이',
      description: '랜덤 고양이 사진과 귀여운 한마디로 힐링하세요',
      icon: '🐱',
      category: 'entertainment',
      isInstalled: false,
      color: 'from-yellow-200 to-orange-200',
      features: ['랜덤 고양이', '귀여운 한마디', '힐링']
    },
    {
      id: 'advice',
      name: '명언',
      description: '영감을 주는 명언으로 하루의 동기부여를 받으세요',
      icon: '💭',
      category: 'information',
      isInstalled: false,
      color: 'from-blue-200 to-indigo-300',
      features: ['한국어 명언', '동기부여', '지혜로운 한마디']
    },
    {
      id: 'music',
      name: '음악 추천',
      description: '오늘의 분위기에 어울리는 음악을 추천해드려요',
      icon: '🎵',
      category: 'entertainment',
      isInstalled: false,
      color: 'from-pink-200 to-purple-200',
      features: ['랜덤 음악', '유튜브 링크', '아티스트 정보']
    },
    {
      id: 'book',
      name: '주목할 만한 신간',
      description: '알라딘에서 선별한 주목할 만한 신간 도서를 확인하세요',
      icon: '📚',
      category: 'information',
      isInstalled: false,
      color: 'from-emerald-200 to-teal-300',
      features: ['신간 도서 추천', '베스트셀러 정보', '독서 문화']
    },
    {
      id: 'weather',
      name: '실시간 날씨',
      description: '정확한 날씨 정보로 하루를 계획하세요',
      icon: '🌤️',
      category: 'information',
      isInstalled: false,
      color: 'from-amber-200 to-orange-300',
      features: ['실시간 날씨', '체감온도', '일출/일몰 시간']
    },
    {
      id: 'stock',
      name: '오늘의 주식',
      description: '주요 종목의 실시간 가격과 등락을 확인하세요',
      icon: '💹',
      category: 'information',
      isInstalled: false,
      color: 'from-lime-200 to-green-200',
      features: ['주요 종목', '실시간 가격', '등락률 표시']
    },
    {
      id: 'news',
      name: '오늘의 미국 뉴스',
      description: '최신 미국 뉴스로 세상의 흐름을 파악하세요',
      icon: '📰',
      category: 'information',
      isInstalled: false,
      color: 'from-red-200 to-rose-300',
      features: ['최신 미국 동향 파악', '글로벌 뉴스', '실시간 업데이트']
    },
    {
      id: 'nasa',
      name: 'NASA 오늘의 우주',
      description: '오늘의 우주 이미지와 정보를 감상하세요',
      icon: '🚀',
      category: 'information',
      isInstalled: false,
      color: 'from-blue-200 to-indigo-200',
      features: ['NASA 이미지', '우주 정보', '링크 제공']
    },
  ];

  const categories = [
    { id: 'all', name: '전체', icon: '📦', count: initialWidgets.length },
    { id: 'entertainment', name: '엔터테인먼트', icon: '🎮', count: initialWidgets.filter(w => w.category === 'entertainment').length },
    { id: 'information', name: '정보', icon: '📊', count: initialWidgets.filter(w => w.category === 'information').length }
  ];

  // 현재 로그인한 사용자 ID 가져오기
  useEffect(() => {
    const initializeWidgets = async () => {
      // 1. 현재 사용자 세션을 가져옵니다.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        try {
          // 2. DB에서 설치된 위젯 목록을 가져옵니다.
          const response = await axios.get(`/api/widgets/user/${session.user.id}`);
          const installedIds = response.data.map((w: any) => w.widget_name);

          // 3. 초기 위젯 목록과 DB 정보를 합쳐 최종 상태를 만듭니다.
          const updatedWidgets = initialWidgets.map(widget => ({
            ...widget,
            isInstalled: installedIds.includes(widget.id)
          }));
          setWidgets(updatedWidgets);
        } catch (error) {
          console.error("설치된 위젯 목록 로딩 실패:", error);
          setWidgets(initialWidgets); // 실패 시 기본값으로 설정
        }
      } else {
        // 세션이 없으면 위젯 목록을 기본 상태로 설정
        setWidgets(initialWidgets);
      }
    };

    initializeWidgets();
  }, []); // 빈 의존성 배열로 최초 1회만 실행

  // 위젯 설치/제거 함수 (API 호출로 변경)
  const toggleWidget = async (widgetId: string) => {
    if (!userId) return; // 사용자 ID가 없으면 함수 종료

    const updatedWidgets = widgets.map(widget =>
      widget.id === widgetId
        ? { ...widget, isInstalled: !widget.isInstalled }
        : widget
    );
    setWidgets(updatedWidgets);

    // DB에 저장할 위젯 목록 (설치된 것만)
    const widgetsToSave = updatedWidgets
      .filter(w => w.isInstalled)
      .map((w, index) => ({
        widget_name: w.id,
        position: index
      }));

    try {
      // 백엔드 API를 호출하여 DB에 저장
      await axios.post(`/api/widgets/user/${userId}`, widgetsToSave);
    } catch (error) {
      console.error("위젯 설정 저장 실패:", error);
      // 에러 발생 시 UI를 원래 상태로 되돌릴 수 있습니다.
      // setWidgets(widgets);
    }
  };

  const filteredWidgets = widgets.filter(widget => {
    const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;
    const matchesSearch = widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         widget.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const installedCount = widgets.filter(w => w.isInstalled).length;

  return (
    <>
      <Head>
        <title>위젯 스토어 - Untold</title>
        <meta name="description" content="다양한 위젯을 선택하여 대시보드를 커스터마이징하세요" />
      </Head>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* 헤더 */}
          <header className="mb-8 text-center relative overflow-hidden">
            {/* 배경 위젯 애니메이션 */}
            <div className="absolute inset-0 pointer-events-none z-0">
              <span
                className="absolute left-[8%] top-20 text-[3rem] opacity-20 animate-floating"
                style={{ animationDuration: '7s', animationTimingFunction: 'ease-in-out' }}
              >📚</span>
              <span
                className="absolute right-[8%] top-32 text-[3rem] opacity-20 animate-floating"
                style={{ animationDuration: '9s', animationTimingFunction: 'ease-in-out', animationDelay: '1s' }}
              >🌤️</span>
              <span
                className="absolute left-[20%] bottom-10 text-[3rem] opacity-20 animate-floating"
                style={{ animationDuration: '8s', animationTimingFunction: 'ease-in-out', animationDelay: '2s' }}
              >💭</span>
              <span
                className="absolute right-[20%] bottom-20 text-[3rem] opacity-20 animate-floating"
                style={{ animationDuration: '10s', animationTimingFunction: 'ease-in-out', animationDelay: '2.5s' }}
              >🐶</span>
              <span
                className="absolute left-[30%] top-1/2 text-[3rem] opacity-20 animate-floating"
                style={{ animationDuration: '7s', animationTimingFunction: 'ease-in-out', animationDelay: '3s' }}
              >📰</span>
              <span
                className="absolute right-[30%] top-1/4 text-[3rem] opacity-20 animate-floating"
                style={{ animationDuration: '8.5s', animationTimingFunction: 'ease-in-out', animationDelay: '1.7s' }}
              >📈</span>
            </div>

            {/* 1. GIF 애니메이션 */}
            <div className="mt-20 mb-8">
              <img 
                src="/widgetStore.gif" 
                alt="위젯 스토어 애니메이션"
                className="w-24 h-24 mx-auto"
              />
            </div>

            {/* 2. 제목 */}
            <h1 className="text-4xl font-bold text-gray-800 mb-6 animate-fade-in">
              위젯 스토어
            </h1>

            {/* 3. 설명 */}
            <p className="text-gray-600 text-lg max-w-2xl mx-auto animate-fade-in-delay mb-8">
              원하는 위젯을 선택하여 나만의 특별한 대시보드를 만들어보세요
            </p>

            {/* 4. 설치 상태 */}
            {installedCount > 0 && (
              <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium animate-fade-in-delay-2">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                {installedCount}개 위젯 설치됨
              </div>
            )}
          </header>

          {/* 검색 및 필터 */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-xl border border-white/20">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* 검색바 */}
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
                </div>
                <input
                  type="text"
                  placeholder="위젯 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-0 bg-white/50 rounded-xl focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all duration-300 placeholder-gray-400"
                />
              </div>
              
              {/* 카테고리 필터 */}
              <div className="flex gap-3 overflow-x-auto pb-2 lg:pb-0">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl whitespace-nowrap transition-all duration-300 transform hover:scale-105 ${
                      selectedCategory === category.id
                        ? 'bg-blue-400/80 text-white shadow-lg border border-blue-300/30'
                        : 'bg-white/50 text-gray-700 hover:bg-white hover:shadow-md'
                    }`}
                  >
                    <span className="text-lg">{category.icon}</span>
                    <span className="font-medium">{category.name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      selectedCategory === category.id 
                        ? 'bg-white/20' 
                        : 'bg-gray-100'
                    }`}>
                      {category.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 위젯 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredWidgets.map(widget => (
              <div 
                key={widget.id} 
                                 className={`group relative bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl ${
                   hoveredWidget === widget.id ? 'ring-2 ring-blue-400' : ''
                 }`}
                onMouseEnter={() => setHoveredWidget(widget.id)}
                onMouseLeave={() => setHoveredWidget(null)}
              >
                {/* 설치 상태 배지 */}
                {widget.isInstalled && (
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium shadow-lg">
                    ✓ 설치됨
                  </div>
                )}

                {/* 위젯 아이콘 */}
                <div className={`w-16 h-16 bg-gradient-to-r ${widget.color} rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-3xl">{widget.icon}</span>
                </div>
                
                {/* 위젯 정보 */}
                                 <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                  {widget.name}
                </h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  {widget.description}
                </p>

                {/* 기능 목록 */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">주요 기능</h4>
                  <div className="space-y-1">
                    {widget.features.map((feature, index) => (
                      <div key={index} className="flex items-center text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 액션 버튼 */}
                <button
                  onClick={() => toggleWidget(widget.id)}
                                     className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 backdrop-blur-sm ${
                     widget.isInstalled
                       ? 'bg-red-400/80 hover:bg-red-500/90 text-white shadow-lg border border-red-300/30'
                       : 'bg-blue-400/80 hover:bg-blue-500/90 text-white shadow-lg border border-blue-300/30'
                   }`}
                >
                  {widget.isInstalled ? '제거하기' : '추가하기'}
                </button>
              </div>
            ))}
          </div>

          {/* 검색 결과가 없을 때 */}
          {filteredWidgets.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">검색 결과가 없습니다</h3>
              <p className="text-gray-600">다른 검색어나 카테고리를 시도해보세요</p>
            </div>
          )}

          {/* 설치된 위젯 관리 */}
          {installedCount > 0 && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 mt-8 shadow-xl border border-white/20">
              <div className="flex items-center gap-3 mb-6">
                                 <div className="w-8 h-8 bg-green-400/80 rounded-lg flex items-center justify-center border border-green-300/30">
                  <span className="text-white">⚙️</span>
                </div>
                <h2 className="text-xl font-bold text-gray-800">설치된 위젯 관리</h2>
                <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium">
                  {installedCount}개
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {widgets.filter(w => w.isInstalled).map(widget => (
                  <div key={widget.id} className="flex items-center justify-between p-4 bg-white/50 rounded-xl hover:bg-white/70 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 bg-gradient-to-r ${widget.color} rounded-lg flex items-center justify-center`}>
                        <span className="text-lg">{widget.icon}</span>
                      </div>
                      <span className="font-medium text-gray-800">{widget.name}</span>
                    </div>
                    <button 
                      onClick={() => toggleWidget(widget.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    >
                      제거
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
} 