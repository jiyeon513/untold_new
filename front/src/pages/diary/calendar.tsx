import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Navigation from '@/components/Navigation';
import EmotionBead from '@/components/EmotionBead';
import { supabase } from '@/api/supabaseClient';
import { useRouter } from 'next/router';

interface DiaryEntry {
  id: string;
  date: string;
  status: 'draft' | 'finalized' | 'deleted';
  mood_vector: number[];
  final_text: string;
}

export default function DiaryCalendar() {
  // 현재 날짜를 7/31로 설정 (한국 시간 기준)
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 6, 31)); // 7월 31일
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 현재 월의 첫째 날과 마지막 날 계산
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  
  // 캘린더 시작일 (이전 달의 날짜들 포함)
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
  
  // 캘린더 종료일 (다음 달의 날짜들 포함)
  const endDate = new Date(lastDayOfMonth);
  endDate.setDate(endDate.getDate() + (6 - lastDayOfMonth.getDay()));

  // 현재 월의 일기 데이터 로드
  useEffect(() => {
    fetchDiaries();
  }, [currentMonth]);

  // 페이지 포커스 시 데이터 새로고침
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 캘린더 페이지 포커스 - 데이터 새로고침');
      fetchDiaries();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchDiaries = async () => {
    try {
      setLoading(true);
      console.log('🔄 일기 데이터 로드 시작...');
      
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error('사용자 정보를 가져올 수 없습니다.', userError);
        return;
      }

      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      console.log(`📅 조회 범위: ${startOfMonth.toISOString().split('T')[0]} ~ ${endOfMonth.toISOString().split('T')[0]}`);

      const { data, error } = await supabase
        .from('diaries')
        .select('*')
        .eq('user_id', userData.user.id)
        .gte('date', startOfMonth.toISOString().split('T')[0])
        .lte('date', endOfMonth.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) {
        console.error('일기 데이터 로드 실패:', error);
        return;
      }

      console.log(`✅ 일기 데이터 로드 완료: ${data?.length || 0}개`);
      if (data && data.length > 0) {
        data.forEach(diary => {
          console.log(`  - ${diary.date}: ${diary.status} (감정: ${diary.mood_vector})`);
        });
      }

      setDiaries(data || []);
    } catch (error) {
      console.error('일기 데이터 로드 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 한국 시간으로 날짜 문자열 생성
  const getKoreanDateString = (date: Date) => {
    const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return koreanTime.toISOString().split('T')[0];
  };

  // 특정 날짜의 일기 찾기
  const getDiaryForDate = (date: Date) => {
    const dateString = getKoreanDateString(date);
    console.log(`🔍 날짜 검색: ${date.toISOString()} → ${dateString}`);
    return diaries.find(diary => diary.date === dateString);
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (date: Date) => {
    const dateString = getKoreanDateString(date);
    const diary = getDiaryForDate(date);
    
    console.log(`📅 날짜 클릭: ${date.toISOString()} → ${dateString}, 일기 존재: ${!!diary}`);
    
    // 일기가 있으면 view로, 없으면 생성 페이지로
    if (diary) {
      router.push(`/diary/view?date=${dateString}&diary_id=${diary.id}`);
    } else {
      router.push(`/diary?date=${dateString}`);
    }
  };

  // 이전/다음 월 이동
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // 오늘 날짜인지 확인 (7/31로 고정)
  const isToday = (date: Date) => {
    const targetDate = new Date(2025, 6, 31); // 7월 31일
    const koreanTargetDate = new Date(targetDate.getTime() + (9 * 60 * 60 * 1000));
    const koreanDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    
    return koreanDate.toDateString() === koreanTargetDate.toDateString();
  };

  // 현재 월의 날짜인지 확인
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth() && 
           date.getFullYear() === currentMonth.getFullYear();
  };

  // 감정 벡터를 이모지로 변환 (기존 함수는 유지하되 사용하지 않음)
  const getMoodEmoji = (moodVector: number[]) => {
    if (!moodVector || moodVector.length < 2) return '😐';
    
    const [valence, arousal] = moodVector;
    
    if (valence > 0.3 && arousal > 0.3) return '😊'; // 기쁨
    if (valence > 0.3 && arousal < -0.3) return '😌'; // 평온
    if (valence < -0.3 && arousal > 0.3) return '😠'; // 분노
    if (valence < -0.3 && arousal < -0.3) return '😔'; // 슬픔
    if (valence > 0.3) return '🙂'; // 기분 좋음
    if (valence < -0.3) return '😐'; // 기분 나쁨
    return '😐'; // 중립
  };

  // 감정 벡터가 유효한지 확인하는 함수 (항상 true 반환하여 감정구슬이 무조건 나오도록)
  const isValidEmotionVector = (moodVector: number[]): boolean => {
    return true; // 항상 감정구슬이 나오도록 true 반환
  };

  // 감정 벡터를 EmotionBead 형식으로 변환 (기본값 제공)
  const convertToEmotionVector = (moodVector: number[]) => {
    if (!isValidEmotionVector(moodVector)) {
      // 기본 감정 벡터 제공 (중립)
      return {
        x: 0, // Valence (중립)
        y: 0  // Arousal (중립)
      };
    }
    return {
      x: moodVector[0] || 0, // Valence
      y: moodVector[1] || 0  // Arousal
    };
  };

  // 캘린더 날짜들 생성
  const calendarDays = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    calendarDays.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (loading) {
    return (
      <>
        <Head>
          <title>일기 캘린더 - Untold</title>
        </Head>
        <Navigation />
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-5">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>일기 캘린더 - Untold</title>
        <meta name="description" content="월간 일기 캘린더" />
      </Head>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-5">
        <div className="max-w-6xl mx-auto">
          {/* 헤더 */}
          <header className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-3">📅 일기 캘린더</h1>
            <p className="text-gray-600 text-lg">날짜를 클릭하여 일기를 작성하세요</p>
          </header>

          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={goToPreviousMonth}
              className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            >
              ← 이전 달
            </button>
            
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
              </h2>
              
              <button
                onClick={fetchDiaries}
                className="p-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition-colors"
                title="데이터 새로고침"
              >
                🔄 새로고침
              </button>
            </div>
            
            <button
              onClick={goToNextMonth}
              className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            >
              다음 달 →
            </button>
          </div>

          {/* 캘린더 그리드 */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                <div key={day} className="text-center font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, index) => {
                const diary = getDiaryForDate(date);
                const isTodayDate = isToday(date);
                const isCurrentMonthDate = isCurrentMonth(date);
                
                return (
                  <div
                    key={index}
                    onClick={() => handleDateClick(date)}
                    className={`
                      aspect-square p-2 border rounded-lg cursor-pointer transition-all duration-200
                      ${isTodayDate 
                        ? 'bg-blue-100 border-blue-300 shadow-lg transform scale-105' 
                        : isCurrentMonthDate 
                          ? 'bg-white border-gray-200 hover:bg-gray-50' 
                          : 'bg-gray-50 border-gray-100 text-gray-400'
                      }
                    `}
                  >
                    <div className="h-full flex flex-col items-center justify-center">
                      {/* 일기 상태 - 감정구슬이 무조건 나오도록 수정 */}
                      {diary ? (
                        <EmotionBead 
                          emotionVector={convertToEmotionVector(diary.mood_vector)} 
                          size="md"
                          className="mx-auto"
                        >
                          {date.getDate()}
                        </EmotionBead>
                      ) : (
                        <>
                          {/* 날짜 */}
                          <div className={`text-sm font-medium ${isTodayDate ? 'text-blue-600' : ''}`}>
                            {date.getDate()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}   