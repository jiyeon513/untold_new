import Navigation from '../../components/Navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useRouter } from 'next/router';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface Scrap {
  id: string;
  category: string;
  content: string;
  scraped_at: string;
}

interface MoodData {
  date: string;
  mood_vector: number[];
  mood_emoji: string;
}

export default function MyPage() {
  const [fontSize, setFontSize] = useState(16);
  const [user, setUser] = useState<User | null>(null);
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [moodData, setMoodData] = useState<MoodData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'scraps' | 'moods' | 'settings'>('profile');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
    fetchScraps();
    fetchMoodData();
  }, []);

  useEffect(() => {
    if (activeTab === 'scraps') {
      fetchScraps();
    }
  }, [selectedDate, activeTab]);

  const fetchUserData = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (user) {
        setUser({
          id: user.id,
          email: user.email || '',
          created_at: user.created_at
        });
      }
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error);
    }
  };

  const fetchScraps = async (date?: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const targetDate = date || selectedDate;
      
      // 한국 시간대로 날짜 처리 (UTC+9)
      const koreaTime = new Date(targetDate.getTime() + (9 * 60 * 60 * 1000));
      const startOfDay = new Date(koreaTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(koreaTime);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('📅 스크랩 날짜 필터링:', {
        selectedDate: targetDate.toISOString(),
        koreaTime: koreaTime.toISOString(),
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString()
      });

      const { data, error } = await supabase
        .from('scraps')
        .select('*')
        .eq('user_id', user.id)
        .gte('scraped_at', startOfDay.toISOString())
        .lt('scraped_at', endOfDay.toISOString())
        .order('scraped_at', { ascending: false });

      if (error) throw error;
      
      console.log('📌 스크랩 조회 결과:', {
        count: data?.length || 0,
        data: data
      });
      
      setScraps(data || []);
    } catch (error) {
      console.error('스크랩 데이터 가져오기 실패:', error);
    }
  };

  const fetchMoodData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('diaries')
        .select('date, mood_vector')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('date', { ascending: false })
        .limit(30);

      if (error) throw error;
      
      const moodDataWithEmoji = (data || []).map(diary => {
        const [valence, arousal] = diary.mood_vector || [0, 0];
        let moodEmoji = '😊';
        
        if (valence > 0.5 && arousal > 0.3) moodEmoji = '😄';
        else if (valence > 0.3 && arousal > 0.3) moodEmoji = '😊';
        else if (valence > 0.3 && arousal <= 0.3) moodEmoji = '😌';
        else if (valence > 0 && arousal > 0.3) moodEmoji = '🤔';
        else if (valence > 0 && arousal <= 0.3) moodEmoji = '😌';
        else if (valence <= 0 && arousal > 0.3) moodEmoji = '😠';
        else if (valence <= 0 && arousal <= 0.3) moodEmoji = '😔';
        else if (valence < -0.5 && arousal > 0.3) moodEmoji = '😡';
        else if (valence < -0.5 && arousal <= 0.3) moodEmoji = '😢';

        return {
          date: diary.date,
          mood_vector: diary.mood_vector,
          mood_emoji: moodEmoji
        };
      });

      setMoodData(moodDataWithEmoji);
    } catch (error) {
      console.error('무드 데이터 가져오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'weather': return '🌤️';
      case 'advice': return '💭';
      case 'book': return '📚';
      case 'news': return '📰';
      case 'randomdog': return '🐕';
      case 'cat': return '🐱';
      case 'music': return '🎵';
      case 'stock': return '📈';
      case 'nasa': return '🚀';
      default: return '📌';
    }
  };

  const formatDate = (dateString: string) => {
    // 한국 시간대로 변환 (UTC+9)
    const koreaTime = new Date(new Date(dateString).getTime() + (9 * 60 * 60 * 1000));
    return koreaTime.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" style={{ fontSize }}>
        <div className="max-w-6xl mx-auto py-8 px-4">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">👤 마이페이지</h1>
            <p className="text-gray-600">나의 Untold 이야기</p>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex justify-center mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg">
              <div className="flex space-x-2">
                {[
                  { id: 'profile', label: '프로필', icon: '👤' },
                  { id: 'scraps', label: '스크랩', icon: '📌' },
                  { id: 'moods', label: '무드', icon: '😊' },
                  { id: 'settings', label: '설정', icon: '⚙️' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg transform scale-105'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 탭 컨텐츠 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                                 <div className="text-center mb-8">
                   <h2 className="text-2xl font-bold text-gray-800 mb-2">안녕하세요!</h2>
                   <p className="text-gray-600">{user?.email}</p>
                 </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-100">
                    <div className="flex items-center space-x-3 mb-4">
                      <span className="text-2xl">📊</span>
                      <h3 className="text-lg font-semibold">활동 통계</h3>
                    </div>
                                         <div className="space-y-3">
                       <div className="flex justify-between">
                         <span className="text-gray-600">총 일기 수</span>
                         <span className="font-semibold">{moodData.length}개</span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-gray-600">스크랩 수</span>
                         <span className="font-semibold">{scraps.length}개</span>
                       </div>
                     </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                    <div className="flex items-center space-x-3 mb-4">
                      <span className="text-2xl">🎯</span>
                      <h3 className="text-lg font-semibold">최근 활동</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">최근 일기</span>
                        <span className="font-semibold">
                          {moodData.length > 0 ? formatDate(moodData[0].date) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">최근 스크랩</span>
                        <span className="font-semibold">
                          {scraps.length > 0 ? formatDate(scraps[0].scraped_at) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

                         {activeTab === 'scraps' && (
               <div className="space-y-6">
                 <div className="flex items-center justify-between mb-6">
                   <h2 className="text-2xl font-bold text-gray-800">📌 내 스크랩</h2>
                   <div className="flex items-center space-x-4">
                     <input
                       type="date"
                       value={selectedDate.toISOString().split('T')[0]}
                       onChange={(e) => {
                         console.log('📅 날짜 선택:', e.target.value);
                         setSelectedDate(new Date(e.target.value));
                       }}
                       className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     />
                     <span className="text-gray-600">{scraps.length}개의 스크랩</span>
                   </div>
                 </div>

                {scraps.length > 0 ? (
                  <div className="space-y-4">
                    {scraps.map((scrap) => (
                      <div
                        key={scrap.id}
                        className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer"
                      >
                        <div className="flex items-center space-x-3 mb-3">
                          <span className="text-2xl">{getCategoryIcon(scrap.category)}</span>
                          <span className="font-semibold text-gray-800 capitalize">{scrap.category}</span>
                        </div>
                        <p className="text-gray-700 text-sm mb-3">{scrap.content}</p>
                        <div className="text-xs text-gray-500">
                          {formatDate(scrap.scraped_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                                 ) : (
                   <div className="text-center py-12">
                     <div className="text-6xl mb-4">📌</div>
                     <h3 className="text-xl font-semibold text-gray-800 mb-2">
                       {selectedDate.toDateString() === new Date().toDateString() 
                         ? '오늘 스크랩한 위젯이 없어요' 
                         : `${selectedDate.toLocaleDateString('ko-KR')}에 스크랩한 위젯이 없어요`}
                     </h3>
                     <p className="text-gray-600">대시보드에서 위젯을 스크랩해보세요!</p>
                   </div>
                 )}
              </div>
            )}

            {activeTab === 'moods' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">😊 무드 트래커</h2>
                  <span className="text-gray-600">{moodData.length}일의 기록</span>
                </div>

                {moodData.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-7 md:grid-cols-10 lg:grid-cols-15 gap-3">
                      {moodData.slice(0, 30).map((mood, index) => (
                        <div
                          key={index}
                          className="flex flex-col items-center p-3 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-100 hover:shadow-md transition-all duration-200 cursor-pointer"
                        >
                          <span className="text-2xl mb-1">{mood.mood_emoji}</span>
                          <span className="text-xs text-gray-600">{formatDate(mood.date)}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-100">
                      <h3 className="text-lg font-semibold mb-4">📈 무드 분석</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-3xl mb-2">😊</div>
                          <div className="text-sm text-gray-600">긍정적</div>
                          <div className="font-semibold">
                            {moodData.filter(m => m.mood_emoji.includes('😊') || m.mood_emoji.includes('😄')).length}일
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl mb-2">😌</div>
                          <div className="text-sm text-gray-600">평온함</div>
                          <div className="font-semibold">
                            {moodData.filter(m => m.mood_emoji.includes('😌')).length}일
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl mb-2">😔</div>
                          <div className="text-sm text-gray-600">부정적</div>
                          <div className="font-semibold">
                            {moodData.filter(m => m.mood_emoji.includes('😔') || m.mood_emoji.includes('😠') || m.mood_emoji.includes('😡') || m.mood_emoji.includes('😢')).length}일
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl mb-2">🤔</div>
                          <div className="text-sm text-gray-600">고민</div>
                          <div className="font-semibold">
                            {moodData.filter(m => m.mood_emoji.includes('🤔')).length}일
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">😊</div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">아직 무드 기록이 없어요</h3>
                    <p className="text-gray-600">일기를 작성하면 무드가 기록됩니다!</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙️ 설정</h2>

                <div className="space-y-6">
                  {/* 글자 크기 조절 */}
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🔤</span>
                        <div>
                          <h3 className="text-lg font-semibold">글자 크기</h3>
                          <p className="text-sm text-gray-600">화면의 글자 크기를 조절합니다</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setFontSize(f => Math.max(12, f - 2))}
                          className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                        >
                          <span className="text-lg">-</span>
                        </button>
                        <span className="font-mono text-lg min-w-[60px] text-center">{fontSize}px</span>
                        <button
                          onClick={() => setFontSize(f => Math.min(32, f + 2))}
                          className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                        >
                          <span className="text-lg">+</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 로그아웃 */}
                  <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-6 border border-red-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🚪</span>
                        <div>
                          <h3 className="text-lg font-semibold">로그아웃</h3>
                          <p className="text-sm text-gray-600">현재 계정에서 로그아웃합니다</p>
                        </div>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
                      >
                        로그아웃
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
} 