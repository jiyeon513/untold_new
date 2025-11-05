import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Navigation from '@/components/Navigation';
import Link from 'next/link';

export default function About() {
  const [isVisible, setIsVisible] = useState<{ [key: string]: boolean }>({});
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(prev => ({
              ...prev,
              [entry.target.id]: true
            }));
          } else {
            // 요소가 화면에서 벗어나면 다시 숨김
            setIsVisible(prev => ({
              ...prev,
              [entry.target.id]: false
            }));
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    // 모든 섹션 요소들을 관찰
    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => observer.disconnect();
  }, []);

  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    sectionRefs.current[id] = el;
  };

  return (
    <>
      <Head>
        <title>소개 - Untold</title>
        <meta name="description" content="Untold - 개인화된 대시보드와 일기 서비스" />
      </Head>
      <Navigation />
      
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* 헤더 섹션 */}
        <header id="header" ref={setRef('header')} className="w-full bg-white/70 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-8 py-12">
            <div className="text-center">
              <div className={`flex items-center justify-center mb-6 transition-all duration-1000 transform ${isVisible['header'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="w-20 h-20 bg-gradient-to-br from-blue-900 to-cyan-400 rounded-full flex items-center justify-center text-4xl text-white font-extrabold border-4 border-white/50 shadow-xl">
                  <span className="drop-shadow-glow">★</span>
                </div>
              </div>
              <h1 className={`text-5xl font-bold text-gray-800 mb-4 transition-all duration-1000 delay-300 transform ${isVisible['header'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>Untold</h1>
              <p className={`text-xl text-gray-600 max-w-2xl mx-auto transition-all duration-1000 delay-500 transform ${isVisible['header'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                나만의 대시보드와 일기 서비스로 당신의 일상을 더욱 특별하게 만들어보세요
              </p>
            </div>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <div className="max-w-7xl mx-auto px-8 py-12">
          {/* 주요 기능 섹션 */}
          <section id="features" ref={setRef('features')} className="mb-16">
            <h2 className={`text-3xl font-bold text-gray-800 text-center mb-12 transition-all duration-1000 transform ${isVisible['features'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>주요 기능</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* 대시보드 */}
              <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 transition-all duration-1000 delay-200 transform ${isVisible['features'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="text-4xl mb-4">🌅</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">개인화된 대시보드</h3>
                <p className="text-gray-600 mb-4">
                  날씨, 뉴스, 음악, 명언 등 다양한 위젯으로 나만의 대시보드를 구성하세요.
                </p>
                <Link href="/dashboard" className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                  대시보드 보기
                </Link>
              </div>

              {/* 일기 */}
              <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 transition-all duration-1000 delay-400 transform ${isVisible['features'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="text-4xl mb-4">📖</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">AI 기반 일기</h3>
                <p className="text-gray-600 mb-4">
                  AI가 도와주는 자동 일기 작성과 감정 분석으로 당신의 하루를 기록하세요.
                </p>
                <Link href="/diary" className="inline-block bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                  일기 작성하기
                </Link>
              </div>

              {/* 위젯 스토어 */}
              <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 transition-all duration-1000 delay-600 transform ${isVisible['features'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="text-4xl mb-4">✨</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">위젯 스토어</h3>
                <p className="text-gray-600 mb-4">
                  다양한 위젯을 선택하고 설치하여 대시보드를 더욱 풍부하게 만들어보세요.
                </p>
                <Link href="/widget-store" className="inline-block bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                  위젯 둘러보기
                </Link>
              </div>
            </div>
          </section>

          {/* 기술 스택 섹션 */}
          <section id="tech" ref={setRef('tech')} className="mb-16">
            <h2 className={`text-3xl font-bold text-gray-800 text-center mb-12 transition-all duration-1000 transform ${isVisible['tech'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>기술 스택</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className={`bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg border border-white/20 transition-all duration-1000 delay-200 transform ${isVisible['tech'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="text-3xl mb-2">⚛️</div>
                <h4 className="font-semibold text-gray-800">React</h4>
                <p className="text-sm text-gray-600">프론트엔드</p>
              </div>
              <div className={`bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg border border-white/20 transition-all duration-1000 delay-300 transform ${isVisible['tech'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="text-3xl mb-2">🚀</div>
                <h4 className="font-semibold text-gray-800">Next.js</h4>
                <p className="text-sm text-gray-600">풀스택 프레임워크</p>
              </div>
              <div className={`bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg border border-white/20 transition-all duration-1000 delay-400 transform ${isVisible['tech'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="text-3xl mb-2">🐍</div>
                <h4 className="font-semibold text-gray-800">Python</h4>
                <p className="text-sm text-gray-600">백엔드 & AI</p>
              </div>
              <div className={`bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg border border-white/20 transition-all duration-1000 delay-500 transform ${isVisible['tech'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="text-3xl mb-2">🤖</div>
                <h4 className="font-semibold text-gray-800">AI/ML</h4>
                <p className="text-sm text-gray-600">감정 분석</p>
              </div>
            </div>
          </section>

          {/* 팀 소개 섹션 */}
          <section id="about" ref={setRef('about')} className="mb-16">
            <h2 className={`text-3xl font-bold text-gray-800 text-center mb-12 transition-all duration-1000 transform ${isVisible['about'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>프로젝트 소개</h2>
            <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 transition-all duration-1000 delay-200 transform ${isVisible['about'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <div className="max-w-3xl mx-auto text-center">
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  Untold는 개인의 일상을 더욱 의미있고 특별하게 만들어주는 개인화된 대시보드 서비스입니다.
                  AI 기술을 활용한 감정 분석과 자동 일기 작성 기능으로 사용자의 감정 상태를 파악하고 
                  더 나은 하루를 위한 제안을 제공합니다.
                </p>
                <p className="text-lg text-gray-700 leading-relaxed">
                  다양한 위젯을 통해 실시간 정보를 확인하고, 개인화된 경험을 통해 
                  일상의 작은 순간들을 더욱 가치있게 만들어보세요.
                </p>
              </div>
            </div>
          </section>

          {/* 시작하기 섹션 */}
          <section id="cta" ref={setRef('cta')} className="text-center">
            <h2 className={`text-3xl font-bold text-gray-800 mb-6 transition-all duration-1000 transform ${isVisible['cta'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>지금 시작해보세요</h2>
            <p className={`text-lg text-gray-600 mb-8 transition-all duration-1000 delay-200 transform ${isVisible['cta'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              Untold와 함께 더욱 특별한 일상을 경험해보세요
            </p>
            <div className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-1000 delay-400 transform ${isVisible['cta'] ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <Link href="/dashboard" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 transform hover:scale-105">
                대시보드 시작하기
              </Link>
              <Link href="/widget-store" className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 transform hover:scale-105">
                위젯 둘러보기
              </Link>
            </div>
          </section>
        </div>
      </main>

      <style jsx>{`
        .drop-shadow-glow {
          filter: drop-shadow(0 0 5px #fff) drop-shadow(0 0 8px #38bdf8);
        }
      `}</style>
    </>
  );
} 