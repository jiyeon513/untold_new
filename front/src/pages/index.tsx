import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/api/supabaseClient';

export default function Home() {
  const [showLogin, setShowLogin] = useState(false);
  const [logoSize, setLogoSize] = useState('text-8xl');
  const router = useRouter();

  useEffect(() => {
    // 1초 후에 로고 크기 줄이기
    const timer1 = setTimeout(() => {
      setLogoSize('text-6xl');
    }, 1000);

    // 2초 후에 로그인 버튼 나타나기
    const timer2 = setTimeout(() => {
      setShowLogin(true);
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // 카카오 로그인 처리 함수
  const handleKakaoLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        scopes: 'profile_nickname',
      }
    });

    if (error) {
      console.error('카카오 로그인 에러:', error.message);
    }
  };

  // Google 로그인 처리 함수
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'email profile',
      }
    });

    if (error) {
      console.error('Google 로그인 에러:', error.message);
    }
  };

  // GitHub 로그인 처리 함수
  const handleGitHubLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'read:user user:email',
      }
    });

    if (error) {
      console.error('GitHub 로그인 에러:', error.message);
    }
  };

  // 사용자의 로그인 상태를 감지하는 useEffect
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // 로그인이 감지되면 대시보드 페이지로 이동
        router.push('/dashboard');
      }
    });
  }, [router]);

  return (
    <>
      <Head>
        <title>Untold - 나도 몰랐던 나를 아는 방법</title>
        <meta name="description" content="하나의 웹 탭에서 아침 대시보드와 밤 자동 일기를 제공하는 올‑인‑원 서비스" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          {/* 로고 */}
          <div className={`font-bold text-gray-900 mb-8 transition-all duration-1000 ease-in-out ${logoSize}`}>
            📑 <span className="text-primary-600">Untold</span>
          </div>
          
          {/* 서브타이틀 */}
          <div className="text-xl text-gray-600 mb-12 transition-opacity duration-1000 ease-in-out">
            나도 몰랐던 나를 아는 방법
          </div>

          {/* 로그인 버튼들 */}
          <div 
            className={`transition-all duration-1000 ease-in-out transform ${
              showLogin 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="space-y-4">
              {/* 카카오 로그인 버튼 */}
              <button
                onClick={handleKakaoLogin}
                className="w-full bg-gradient-to-r from-yellow-300 to-yellow-400 hover:from-yellow-200 hover:to-yellow-300 text-black font-semibold py-3 px-6 rounded-lg text-base shadow-xl hover:shadow-2xl transition-all duration-300 transform scale-105 hover:scale-110 flex items-center justify-center backdrop-blur-sm bg-opacity-90 border border-yellow-200/50"
              >
                <span className="mr-2">📱</span>
                카카오로 로그인/회원가입
              </button>
              
              {/* Google 로그인 버튼 */}
              <button
                onClick={handleGoogleLogin}
                className="w-full bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-300 hover:to-blue-400 text-white font-semibold py-3 px-6 rounded-lg text-base shadow-xl hover:shadow-2xl transition-all duration-300 transform scale-105 hover:scale-110 flex items-center justify-center backdrop-blur-sm bg-opacity-90 border border-blue-200/50"
              >
                <span className="mr-2">🔍</span>
                Google로 로그인/회원가입
              </button>
              
              {/* GitHub 로그인 버튼 */}
              <button
                onClick={handleGitHubLogin}
                className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white font-semibold py-3 px-6 rounded-lg text-base shadow-xl hover:shadow-2xl transition-all duration-300 transform scale-105 hover:scale-110 flex items-center justify-center backdrop-blur-sm bg-opacity-90 border border-gray-500/50"
              >
                <span className="mr-2">🐙</span>
                GitHub로 로그인/회원가입
              </button>
            </div>
          </div>

          {/* 추가 설명 */}
          <div 
            className={`mt-6 text-gray-500 transition-opacity duration-1000 ease-in-out delay-500 ${
              showLogin ? 'opacity-100' : 'opacity-0'
            }`}
          >
            하나의 웹 탭에서 아침 대시보드와 밤 자동 일기를 제공하는 올‑인‑원 서비스
          </div>
        </div>
      </main>
    </>
  );
} 