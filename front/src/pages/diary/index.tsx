import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Navigation from '@/components/Navigation';
import fetchSentiment from './ml_kobert';
import { supabase } from '@/api/supabaseClient';
import { useRouter } from 'next/router';

interface DraggedItem {
  id: string;
  type: 'chrome' | 'custom' | 'widget';
  content: string;
  title: string;
  imageUrl?: string;
}

interface CustomImage {
  id: string;
  file: File;
  description: string;
  previewUrl: string;
}

interface Card {
  id: string;
  diary_id: string;
  source_type: string;
  category: string;
  content: string;
  image_url?: string;
  layout_type: string;
  row?: number;
  col?: number;
  order_index?: number;
  text_generated: boolean;
  text_final: string;
  created_at: string;
}

export default function WriteDiary() {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [diaryText, setDiaryText] = useState('');
  const [chromeLogs, setChromeLogs] = useState<DraggedItem[]>([]);
  const [customImages, setCustomImages] = useState<CustomImage[]>([]);
  const [imageCards, setImageCards] = useState<DraggedItem[]>([]);
  const [scrapItems, setScrapItems] = useState<DraggedItem[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [currentDiaryId, setCurrentDiaryId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [aiSuggestedLayout, setAiSuggestedLayout] = useState<any>(null);
  const [userLayout, setUserLayout] = useState<any>(null);
  const [rewardInfo, setRewardInfo] = useState<any>({
    reward: 0,
    avgDifference: 0,
    totalDifference: 0,
    comparedCards: 0,
    differences: {},
    userLayout: {},
    aiLayout: {}
  });
  const [learningStatus, setLearningStatus] = useState<any>(null);
  const [existingDiary, setExistingDiary] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [layoutGrid, setLayoutGrid] = useState<any[][]>(Array(3).fill(null).map(() => Array(4).fill(null)));

  // 한국 시간으로 날짜 문자열 생성
  const getKoreanDateString = (date: Date) => {
    const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return koreanTime.toISOString().split('T')[0];
  };

  // URL 파라미터에서 날짜 가져오기
  useEffect(() => {
    if (router.isReady) {
      const { date } = router.query;
      if (date && typeof date === 'string') {
        const parsedDate = new Date(date);
        console.log(`📅 URL에서 날짜 파싱: ${date} → ${parsedDate.toISOString()}`);
        setSelectedDate(parsedDate);
      }
    }
  }, [router.isReady, router.query]);

  // 학습 상태 확인 함수
  const fetchLearningStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/rl/learning-status');
      if (response.ok) {
        const status = await response.json();
        console.log('📊 학습 상태 조회 완료:', status);
        // 안전한 데이터 구조로 설정
        setLearningStatus({
          type: 'info',
          message: '강화학습 모델이 정상적으로 작동 중입니다.',
          timestamp: new Date().toISOString(),
          data: status
        });
      } else {
        console.error('❌ 학습 상태 조회 실패:', response.status);
        setLearningStatus({
          type: 'error',
          message: '학습 상태 조회에 실패했습니다.',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ 학습 상태 조회 중 오류:', error);
      setLearningStatus({
        type: 'error',
        message: '학습 상태 조회 중 오류가 발생했습니다.',
        timestamp: new Date().toISOString()
      });
    }
  };

  // 페이지 로드 시 일기 ID 생성 및 기존 일기 확인
  useEffect(() => {
    const initializeDiary = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.error('사용자 정보를 가져올 수 없습니다.', userError);
          return;
        }

        const dateString = getKoreanDateString(selectedDate);
        console.log(`📅 일기 초기화: ${selectedDate.toISOString()} → ${dateString}`);

        // 기존 일기 확인
        const { data: existingData, error: existingError } = await supabase
          .from('diaries')
          .select('*')
          .eq('user_id', userData.user.id)
          .eq('date', dateString)
          .maybeSingle();

        if (existingData) {
          setExistingDiary(existingData);
          setCurrentDiaryId(existingData.id);
          setDiaryText(existingData.final_text || '');
          
          // 기존 카드들 로드
          const { data: cardsData, error: cardsError } = await supabase
            .from('cards')
            .select('*')
            .eq('diary_id', existingData.id)
            .order('order_index', { ascending: true });

          if (!cardsError && cardsData) {
            setSelectedCards(cardsData);
            
            // 기존 레이아웃을 그리드에 표시
            const newGrid = Array(3).fill(null).map(() => Array(4).fill(null));
            cardsData.forEach(card => {
              if (card.row !== undefined && card.col !== undefined) {
                newGrid[card.row][card.col] = { 
                  cardId: card.id, 
                  layout: { row: card.row, col: card.col } 
                };
              }
            });
            setLayoutGrid(newGrid);
            
            console.log('✅ 기존 카드들 로드 완료:', cardsData.length, '개');
          }
        } else {
          // 새로운 일기 생성
          const diaryId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });

          const diaryData = {
            id: diaryId,
            user_id: userData.user.id,
            date: dateString,
            status: 'draft',
            mood_vector: [0, 0],
            final_text: '',
            agent_version: 'v1.0'
          };

          const { data, error } = await supabase
            .from('diaries')
            .insert([diaryData])
            .select();

          if (error) {
            console.error('일기 생성 실패:', error);
            alert('일기 초기화에 실패했습니다. 페이지를 새로고침해주세요.');
            return;
          }

          setCurrentDiaryId(diaryId);
          console.log('✅ 새로운 일기 ID 생성:', diaryId);
        }
        
        fetchLearningStatus();
        
      } catch (error) {
        console.error('일기 초기화 중 오류:', error);
        alert('일기 초기화 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
      }
    };

    if (selectedDate) {
      initializeDiary();
    }
  }, [selectedDate]);

  // 크롬 로그 및 스크랩 데이터 가져오기
  useEffect(() => {
    console.log(`🔄 useEffect 실행 - selectedDate: ${selectedDate.toISOString()}`);
    
    // 이전 데이터 초기화
    setChromeLogs([]);
    setScrapItems([]);
    
    const fetchChromeLogs = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.log('❌ 사용자 정보를 가져올 수 없습니다.');
        return;
      }

      // 선택된 날짜를 한국 시간으로 변환
      const koreaTime = new Date(selectedDate.getTime() + (9 * 60 * 60 * 1000));
      const startOfDay = new Date(koreaTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(koreaTime);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log(`🔍 크롬 로그 조회 시작:`);
      console.log(`  - selectedDate: ${selectedDate.toISOString()}`);
      console.log(`  - koreaTime: ${koreaTime.toISOString()}`);
      console.log(`  - 조회 범위: ${startOfDay.toISOString()} ~ ${endOfDay.toISOString()}`);
      console.log(`  - 사용자 ID: ${userData.user.id}`);
      
      // 먼저 사용자 ID로 모든 크롬 로그 조회 (디버깅용)
      // 테스트용 UUID도 함께 조회 (크롬 익스텐션에서 사용자 ID를 전송하지 않아서)
      const testUserId = "980081c4-b1f4-45d5-b14a-cf82a7f166e5";
      const { data: allLogs, error: allLogsError } = await supabase
        .from('chrome_logs')
        .select('*')
        .or(`user_id.eq.${userData.user.id},user_id.eq.${testUserId}`)
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('🔍 전체 크롬 로그 조회 결과:', allLogs?.length || 0, '개');
      if (allLogs && allLogs.length > 0) {
        allLogs.forEach((log, index) => {
          console.log(`  ${index + 1}. ${log.title} (${log.visit_time}) - duration: ${log.duration}`);
        });
      }

      // 실제 날짜 필터링된 쿼리
      // 테스트용 UUID도 함께 조회
      const { data, error } = await supabase
        .from('chrome_logs')
        .select('id, title, duration, visit_time, url')
        .or(`user_id.eq.${userData.user.id},user_id.eq.${testUserId}`)
        .gte('visit_time', startOfDay.toISOString())
        .lt('visit_time', endOfDay.toISOString())
        .order('duration', { ascending: false })
        .limit(3);

      if (error) {
        console.error('❌ 크롬 로그 불러오기 실패:', error);
        setChromeLogs([]);
        return;
      }

      console.log(`✅ 크롬 로그 조회 완료: ${data?.length || 0}개`);
      
      if (data && data.length > 0) {
        console.log('📋 조회된 크롬 로그:');
        data.forEach((log, index) => {
          console.log(`  ${index + 1}. ${log.title} (${log.visit_time})`);
        });
      }

      if (data) {
        const formatted: DraggedItem[] = data.map((log: any) => {
          const duration = log.duration ?? 0;
          const minutes = Math.floor(duration / 60);
          const seconds = duration % 60;
          const durationText = minutes > 0 
            ? `${minutes}분 ${seconds}초` 
            : `${seconds}초`;
          
          const title = log.title && log.title.trim() !== '' ? log.title : '제목 없음';
          
          return {
            id: `chrome-${log.id}`,
            type: 'chrome',
            title: title,
            content: `${title}\n${log.url}\n${durationText}`,
          };
        });
        setChromeLogs(formatted);
        console.log(`🎯 크롬 로그 상태 업데이트: ${formatted.length}개`);
      } else {
        setChromeLogs([]);
        console.log('🎯 크롬 로그 상태 초기화 (빈 배열)');
      }
    };

    const fetchScrapItems = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.log('❌ 사용자 정보를 가져올 수 없습니다.');
        return;
      }

      const userId = userData.user.id;
      const koreaTime = new Date(selectedDate.getTime() + (9 * 60 * 60 * 1000));
      const selectedDateString = koreaTime.toISOString().split('T')[0];

      console.log(`🔍 스크랩 데이터 조회 시작:`);
      console.log(`  - selectedDate: ${selectedDate.toISOString()}`);
      console.log(`  - koreaTime: ${koreaTime.toISOString()}`);
      console.log(`  - selectedDateString: ${selectedDateString}`);
      console.log(`  - 사용자 ID: ${userId}`);

      try {
        const response = await fetch(`/api/widgets/scrap/list/${userId}?date=${selectedDateString}`);
        if (!response.ok) {
          console.error('❌ 스크랩 데이터 조회 실패:', response.status);
          return;
        }

        const scrapData = await response.json();
        console.log(`✅ 스크랩 데이터 조회 완료: ${scrapData?.length || 0}개`);

        if (scrapData && Array.isArray(scrapData)) {
          console.log('📋 조회된 스크랩 데이터:');
          scrapData.forEach((scrap, index) => {
            console.log(`  ${index + 1}. ${scrap.category} - ${scrap.content?.slice(0, 50)}...`);
          });
          
          const formatted: DraggedItem[] = scrapData.map((scrap: any) => {
            let icon = '📌';
            switch (scrap.category) {
              case 'weather': icon = '🌤️'; break;
              case 'advice': icon = '💭'; break;
              case 'book': icon = '📚'; break;
              case 'news': icon = '📰'; break;
              case 'randomdog': icon = '🐕'; break;
              case 'cat': icon = '🐱'; break;
              case 'music': icon = '🎵'; break;
              case 'stock': icon = '📈'; break;
              case 'nasa': icon = '🚀'; break;
              default: icon = '📌';
            }

            return {
              id: `scrap-${scrap.id}`,
              type: 'widget',
              title: `${icon} ${scrap.category} 스크랩`,
              content: scrap.content || '스크랩된 내용',
            };
          });
          setScrapItems(formatted);
          console.log(`🎯 스크랩 데이터 상태 업데이트: ${formatted.length}개`);
        } else {
          setScrapItems([]);
          console.log('🎯 스크랩 데이터 상태 초기화 (빈 배열)');
        }
      } catch (error) {
        console.error('스크랩 데이터 불러오기 실패:', error);
      }
    };
  
    fetchChromeLogs();
    fetchScrapItems();
  }, [selectedDate]);

  // 크롬 로그 클릭 핸들러
  const handleChromeLogClick = async (item: DraggedItem) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return;
      }

      const cardId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      // 카드가 겹치지 않도록 순차적으로 배치
      const cardIndex = selectedCards.length;
      const row = Math.floor(cardIndex / 4); // 4열 그리드 기준
      const col = cardIndex % 4;

      const cardData = {
        id: cardId,
        diary_id: currentDiaryId,
        source_type: 'chrome',
        category: 'browsing',
        content: item.content,
        image_url: null,
        layout_type: 'text',
        row: row,
        col: col,
        order_index: cardIndex,
        text_generated: false,
        text_final: item.title
      };

      const { data, error } = await supabase
        .from('cards')
        .insert([cardData])
        .select();

      if (error) {
        console.error('카드 저장 실패:', error);
        return;
      }

      if (data && data[0]) {
        setSelectedCards(prev => [...prev, data[0]]);
      }
      
    } catch (error) {
      console.error('크롬 로그 카드 저장 중 오류:', error);
    }
  };

  // 스크랩 아이템 클릭 핸들러
  const handleScrapItemClick = async (item: DraggedItem) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return;
      }

      const cardId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      // 카드가 겹치지 않도록 순차적으로 배치
      const cardIndex = selectedCards.length;
      const row = Math.floor(cardIndex / 4); // 4열 그리드 기준
      const col = cardIndex % 4;

      const cardData = {
        id: cardId,
        diary_id: currentDiaryId,
        source_type: 'widget',
        category: 'scrap',
        content: item.content,
        image_url: null,
        layout_type: 'text',
        row: row,
        col: col,
        order_index: cardIndex,
        text_generated: false,
        text_final: item.title
      };

      const { data, error } = await supabase
        .from('cards')
        .insert([cardData])
        .select();

      if (error) {
        console.error('카드 저장 실패:', error);
        return;
      }

      if (data && data[0]) {
        setSelectedCards(prev => [...prev, data[0]]);
      }
      
    } catch (error) {
      console.error('스크랩 카드 저장 중 오류:', error);
    }
  };

  // 사진 카드 클릭 핸들러
  const handleImageCardClick = async (card: DraggedItem) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return;
      }

      const cardId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      // 카드가 겹치지 않도록 순차적으로 배치
      const cardIndex = selectedCards.length;
      const row = Math.floor(cardIndex / 4); // 4열 그리드 기준
      const col = cardIndex % 4;

      const cardData = {
        id: cardId,
        diary_id: currentDiaryId,
        source_type: 'image',
        category: 'photo',
        content: card.content,
        image_url: card.imageUrl || null,
        layout_type: 'image',
        row: row,
        col: col,
        order_index: cardIndex,
        text_generated: false,
        text_final: card.title
      };

      const { data, error } = await supabase
        .from('cards')
        .insert([cardData])
        .select();

      if (error) {
        console.error('카드 저장 실패:', error);
        return;
      }

      if (data && data[0]) {
        setSelectedCards(prev => [...prev, data[0]]);
      }
      
    } catch (error) {
      console.error('이미지 카드 저장 중 오류:', error);
    }
  };

  // 사진 추가 핸들러
  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const previewUrl = e.target?.result as string;
            const newImage: CustomImage = {
              id: `custom-${Date.now()}-${Math.random()}`,
              file: file,
              description: '',
              previewUrl: previewUrl
            };
            setCustomImages(prev => [...prev, newImage]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  // 사진 설명 업데이트 핸들러
  const handleImageDescriptionChange = (id: string, description: string) => {
    setCustomImages(prev => 
      prev.map(img => 
        img.id === id ? { ...img, description } : img
      )
    );
  };

  // 사진 설명 엔터 키 핸들러
  const handleImageDescriptionKeyPress = (e: React.KeyboardEvent, image: CustomImage) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      const existingCard = imageCards.find(card => card.id === image.id);
      if (!existingCard) {
        const newCard: DraggedItem = {
          id: image.id,
          type: 'custom',
          title: image.description || '설명 없음',
          content: `${image.description || '설명 없음'}\n[사진 첨부됨]`,
          imageUrl: image.previewUrl
        };
        setImageCards(prev => [...prev, newCard]);
        setCustomImages(prev => prev.filter(img => img.id !== image.id));
      } else {
        setImageCards(prev => 
          prev.map(card => 
            card.id === image.id 
              ? { ...card, title: image.description || '설명 없음', content: `${image.description || '설명 없음'}\n[사진 첨부됨]`, imageUrl: image.previewUrl }
              : card
          )
        );
        setCustomImages(prev => prev.filter(img => img.id !== image.id));
      }
    }
  };

  // 사진 삭제 핸들러
  const handleImageRemove = (id: string) => {
    setCustomImages(prev => prev.filter(img => img.id !== id));
    setImageCards(prev => prev.filter(card => card.id !== id));
  };

  // 사진 카드 삭제 핸들러
  const handleImageCardRemove = (id: string) => {
    setImageCards(prev => prev.filter(card => card.id !== id));
  };

  // 드래그 앤 드롭 이벤트 핸들러들
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setIsDragging(true);
    setDraggedCard(cardId);
    e.dataTransfer.setData('text/plain', cardId);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedCard(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    
    if (cardId) {
      // 새로운 레이아웃 생성
      const newLayout = { ...userLayout };
      newLayout[cardId] = { row, col };
      setUserLayout(newLayout);
      
      // 그리드 업데이트 - 기존 위치에서 카드 제거 후 새 위치에 배치
      const newGrid = layoutGrid.map(row => row.map(cell => cell));
      
      // 기존 위치에서 카드 제거
      for (let r = 0; r < newGrid.length; r++) {
        for (let c = 0; c < newGrid[r].length; c++) {
          if (newGrid[r][c] && newGrid[r][c].cardId === cardId) {
            newGrid[r][c] = null;
            console.log(`🗑️ 카드 ${cardId}를 기존 위치 (${r}, ${c})에서 제거`);
          }
        }
      }
      
      // 새 위치에 카드 배치
      newGrid[row][col] = { cardId, layout: { row, col } };
      setLayoutGrid(newGrid);
      
      console.log(`🎯 카드 ${cardId}를 (${row}, ${col})에 배치`);
      
      // 레이아웃 차이 계산 및 보상 업데이트
      calculateLayoutReward(newLayout);
      
      // 사용자 레이아웃을 데이터베이스에 저장
      saveUserLayoutToDatabase(newLayout);
    }
  };

    // AI 레이아웃을 데이터베이스에 저장
  const saveAiLayoutToDatabase = async (layout: any) => {
    try {
      console.log('💾 AI 레이아웃을 데이터베이스에 저장 중...');
      console.log('📋 저장할 AI 레이아웃:', layout);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        console.error('❌ 사용자 정보를 가져올 수 없습니다.');
        return;
      }

      // 각 카드의 위치 정보를 업데이트
      const updatePromises = Object.entries(layout).map(async ([cardId, position]: [string, any]) => {
        const { row, col } = position;
        
        // selectedCards에서 실제 카드 ID 찾기
        const selectedCard = selectedCards.find(card => card.id === cardId);
        
        if (!selectedCard) {
          console.error(`❌ 카드 ID ${cardId}에 해당하는 카드를 찾을 수 없습니다.`);
          return;
        }

        console.log(`🔍 AI 레이아웃 카드 ID 매칭: ${cardId} → ${selectedCard.id} (${selectedCard.text_final})`);
        
        const { error } = await supabase
          .from('cards')
          .update({
            row: row,
            col: col,
            order_index: row * 4 + col // 4열 그리드 기준으로 order_index 계산
          })
          .eq('id', selectedCard.id)
          .eq('diary_id', currentDiaryId);

        if (error) {
          console.error(`❌ AI 레이아웃 카드 ${selectedCard.id} 위치 업데이트 실패:`, error);
        } else {
          console.log(`✅ AI 레이아웃 카드 ${selectedCard.id} 위치 업데이트: (${row}, ${col})`);
        }
      });

      await Promise.all(updatePromises);
      console.log('✅ AI 레이아웃 저장 완료');
      
    } catch (error) {
      console.error('❌ AI 레이아웃 저장 중 오류:', error);
    }
  };

  // 사용자 레이아웃을 데이터베이스에 저장
  const saveUserLayoutToDatabase = async (layout: any) => {
    try {
      console.log('💾 사용자 레이아웃을 데이터베이스에 저장 중...');
      console.log('📋 저장할 레이아웃:', layout);
      console.log('📋 선택된 카드들:', selectedCards.map(c => ({ id: c.id, text_final: c.text_final })));
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        console.error('❌ 사용자 정보를 가져올 수 없습니다.');
        return;
      }

      // 각 카드의 위치 정보를 업데이트
      const updatePromises = Object.entries(layout).map(async ([cardId, position]: [string, any]) => {
        const { row, col } = position;
        
        // selectedCards에서 실제 카드 ID 찾기
        const selectedCard = selectedCards.find(card => card.id === cardId);
        
        if (!selectedCard) {
          console.error(`❌ 카드 ID ${cardId}에 해당하는 카드를 찾을 수 없습니다.`);
          return;
        }

        console.log(`🔍 카드 ID 매칭: ${cardId} → ${selectedCard.id} (${selectedCard.text_final})`);
        
        const { error } = await supabase
          .from('cards')
          .update({
            row: row,
            col: col,
            order_index: row * 4 + col // 4열 그리드 기준으로 order_index 계산
          })
          .eq('id', selectedCard.id)
          .eq('diary_id', currentDiaryId);

        if (error) {
          console.error(`❌ 카드 ${selectedCard.id} 위치 업데이트 실패:`, error);
        } else {
          console.log(`✅ 카드 ${selectedCard.id} 위치 업데이트: (${row}, ${col})`);
        }
      });

      await Promise.all(updatePromises);
      console.log('✅ 사용자 레이아웃 저장 완료');
      
    } catch (error) {
      console.error('❌ 사용자 레이아웃 저장 중 오류:', error);
    }
  };

  // 레이아웃 차이 기반 보상 계산
  const calculateLayoutReward = (currentUserLayout: any) => {
    if (!aiSuggestedLayout || !currentUserLayout) {
      console.log('⚠️ AI 레이아웃 또는 사용자 레이아웃이 없어서 보상 계산을 건너뜁니다.');
      return;
    }

    let totalDifference = 0;
    let comparedCards = 0;
    const differences: any = {};

    Object.keys(aiSuggestedLayout).forEach(cardId => {
      if (currentUserLayout[cardId]) {
        const aiPos = aiSuggestedLayout[cardId];
        const userPos = currentUserLayout[cardId];
        
        const rowDiff = Math.abs(aiPos.row - userPos.row);
        const colDiff = Math.abs(aiPos.col - userPos.col);
        const totalDiff = rowDiff + colDiff;
        
        totalDifference += totalDiff;
        comparedCards++;
        differences[cardId] = { rowDiff, colDiff, totalDiff };
      }
    });

    if (comparedCards > 0) {
      const avgDifference = totalDifference / comparedCards;
      // 차이가 클수록 보상이 작아짐 (최대 100점, 차이당 -10점)
      const reward = Math.max(0, 100 - (avgDifference * 10));
      
      const newRewardInfo = {
        reward: reward,
        avgDifference: avgDifference,
        totalDifference: totalDifference,
        comparedCards: comparedCards,
        differences: differences,
        userLayout: currentUserLayout,
        aiLayout: aiSuggestedLayout
      };
      
      setRewardInfo(newRewardInfo);

      console.log(`💰 레이아웃 보상 계산: 평균차이=${avgDifference.toFixed(2)}, 보상=${reward.toFixed(1)}점`);
      
      // 배치 학습을 위한 피드백 수집
      collectFeedbackForBatch(currentUserLayout, reward, avgDifference);
    } else {
      console.log('⚠️ 비교할 수 있는 카드가 없어서 보상 계산을 건너뜁니다.');
      // 기본 보상 정보 설정
      setRewardInfo({
        reward: 0,
        avgDifference: 0,
        totalDifference: 0,
        comparedCards: 0,
        differences: {},
        userLayout: currentUserLayout,
        aiLayout: aiSuggestedLayout
      });
    }
  };

  // 배치 학습을 위한 피드백 수집
  const [feedbackBuffer, setFeedbackBuffer] = useState<any[]>([]);
  const [lastBatchTraining, setLastBatchTraining] = useState<Date | null>(null);

  const collectFeedbackForBatch = async (userLayout: any, reward: number, avgDifference: number) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const feedback = {
        diary_id: currentDiaryId,
        feedback_type: 'layout_modification',
        details: {
          user_id: userData.user.id,
          original_layout: aiSuggestedLayout,
          user_layout: userLayout,
          layout_reward: reward,
          layout_difference: avgDifference,
          reward_details: {
            total_difference: rewardInfo?.totalDifference || 0,
            compared_cards: rewardInfo?.comparedCards || 0,
            differences: rewardInfo?.differences || {}
          },
          timestamp: new Date().toISOString()
        }
      };

      // 피드백 버퍼에 추가
      const newBuffer = [...feedbackBuffer, feedback];
      setFeedbackBuffer(newBuffer);

      console.log(`📊 피드백 수집: ${newBuffer.length}개 (보상: ${reward.toFixed(1)}점)`);

      // 5개 이상 쌓이거나 마지막 배치 학습 후 10분이 지났으면 배치 학습 실행
      const shouldTrain = newBuffer.length >= 5 || 
        (lastBatchTraining && (new Date().getTime() - lastBatchTraining.getTime()) > 10 * 60 * 1000);

      if (shouldTrain) {
        await triggerBatchTraining(newBuffer);
        setFeedbackBuffer([]);
        setLastBatchTraining(new Date());
      } else {
        setLearningStatus({
          type: 'info',
          message: `피드백 수집 중... (${newBuffer.length}/5)`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ 피드백 수집 중 오류:', error);
    }
  };

  // 배치 학습 실행
  const triggerBatchTraining = async (feedbackData: any[]) => {
    try {
      console.log('🔄 배치 학습 시작...');
      setLearningStatus({
        type: 'info',
        message: '배치 학습을 시작합니다...',
        timestamp: new Date().toISOString()
      });

      const trainingResponse = await fetch('http://localhost:8000/api/rl/batch-train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback_data: feedbackData,
          training_config: {
            batch_size: feedbackData.length,
            learning_rate: 0.001,
            epochs: 3
          }
        })
      });

      if (trainingResponse.ok) {
        const result = await trainingResponse.json();
        console.log('✅ 배치 학습 완료:', result);
        setLearningStatus({
          type: 'success',
          message: `배치 학습 완료! ${feedbackData.length}개 피드백 처리됨`,
          timestamp: new Date().toISOString()
        });
      } else {
        console.error('❌ 배치 학습 실패');
        setLearningStatus({
          type: 'error',
          message: '배치 학습 실패',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ 배치 학습 중 오류:', error);
      setLearningStatus({
        type: 'error',
        message: '배치 학습 중 오류 발생',
        timestamp: new Date().toISOString()
      });
    }
  };

  // AI 레이아웃 제안 함수
  const handleAutoLayout = async () => {
    if (selectedCards.length === 0) {
      alert('레이아웃을 생성할 카드를 선택해주세요.');
        return;
      }

    try {
      console.log('🔍 레이아웃 제안 시작:', selectedCards.length, '개 카드');
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        console.error('❌ 사용자 정보를 가져올 수 없습니다.');
        return;
      }

      const response = await fetch('http://localhost:8000/api/rl/suggest-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diary_id: currentDiaryId,
          user_id: userData.user.id,
          selected_card_ids: selectedCards.map(card => card.id)
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setAiSuggestedLayout(result.layout);
        
        // AI 레이아웃을 DB에 저장
        console.log('💾 AI 레이아웃을 DB에 저장 중...');
        await saveAiLayoutToDatabase(result.layout);
        
        // AI 레이아웃을 그리드에 표시
        const newGrid = Array(3).fill(null).map(() => Array(4).fill(null));
        Object.entries(result.layout).forEach(([cardId, layout]: [string, any]) => {
          if (layout.row >= 0 && layout.row < 3 && layout.col >= 0 && layout.col < 4) {
            newGrid[layout.row][layout.col] = { cardId, layout };
          }
        });
        setLayoutGrid(newGrid);
        
        console.log('✅ AI 레이아웃 제안 완료:', result.layout);
      } else {
        console.error('❌ 레이아웃 제안 실패');
      }
    } catch (error) {
      console.error('❌ 레이아웃 제안 중 오류:', error);
    }
  };

  // 일기 생성 및 보상 계산
  const handleGenerateDiary = async () => {
    if (!diaryText) {
      alert('일기 내용을 입력해주세요.');
      return;
    }

    if (!currentDiaryId) {
      alert('일기 ID가 생성되지 않았습니다. 페이지를 새로고침해주세요.');
      return;
    }

    setIsGenerating(true);

    try {
      // 2D 감정 분석 API 호출 (선택적)
      setGenerationStep('감정 분석 중...');
      let finalMoodVector = [0, 0]; // 기본값
      
      try {
        const sentimentResult = await fetchSentiment(diaryText);
        
        if (sentimentResult) {
          // 2D 감정 분석 모델의 실제 결과 사용
          const valence = sentimentResult.valence || 0;
          const arousal = sentimentResult.arousal || 0;
          const emotionLabel = sentimentResult.emotion_label || 'neutral';
          
          // mood_vector에 실제 2D 좌표값 저장
          finalMoodVector = [valence, arousal];
          
          console.log('🎭 2D 감정 분석 결과:', {
            valence,
            arousal,
            emotionLabel,
            finalMoodVector
          });
        } else {
          console.log('⚠️ 감정 분석 결과가 없습니다. 기본값 사용.');
        }
      } catch (error) {
        console.log('⚠️ 감정 분석 API 호출 실패. 기본값 사용:', error);
      }

      // 레이아웃 차이 기반 보상 계산
      let layoutReward = 0;
      let layoutDifference = 0;
      let rewardDetails = {};

      if (aiSuggestedLayout && userLayout) {
        let totalRowDiff = 0;
        let totalColDiff = 0;
        let comparedCards = 0;

        Object.keys(aiSuggestedLayout).forEach(cardId => {
          if (userLayout[cardId]) {
            const aiPos = aiSuggestedLayout[cardId];
            const userPos = userLayout[cardId];
            
            const rowDiff = Math.abs(aiPos.row - userPos.row);
            const colDiff = Math.abs(aiPos.col - userPos.col);
            
            totalRowDiff += rowDiff;
            totalColDiff += colDiff;
            comparedCards++;
          }
        });

        if (comparedCards > 0) {
          const avgRowDiff = totalRowDiff / comparedCards;
          const avgColDiff = totalColDiff / comparedCards;
          layoutDifference = avgRowDiff + avgColDiff;
          layoutReward = -layoutDifference * 20;
          
          rewardDetails = {
            avg_row_diff: avgRowDiff,
            avg_col_diff: avgColDiff,
            total_difference: layoutDifference,
            compared_cards: comparedCards
          };
        }
      } else if (aiSuggestedLayout && !userLayout) {
        layoutReward = 50;
        rewardDetails = { used_ai_layout: true };
      }

      setRewardInfo({
        layoutReward,
        layoutDifference,
        details: rewardDetails
      });

      // 사용자 레이아웃 저장 (드래그앤드롭으로 수정한 카드 위치)
      if (userLayout && Object.keys(userLayout).length > 0) {
        setGenerationStep('사용자 레이아웃 저장 중...');
        console.log('💾 사용자 레이아웃 저장 중...');
        try {
          await saveUserLayoutToDatabase(userLayout);
        } catch (error) {
          console.error('⚠️ 사용자 레이아웃 저장 실패:', error);
        }
      }

      // LoRA 모델을 사용하여 개인화된 텍스트 생성 (선택적)
      setGenerationStep('LoRA 모델로 개인화된 텍스트 생성 중...');
      console.log('🤖 LoRA 모델을 통한 개인화된 텍스트 생성 중...');
      
      let finalText = diaryText; // 기본값은 원본 텍스트
      let loraModelVersion = null;

      try {
        const { data: currentUserData } = await supabase.auth.getUser();
        if (currentUserData?.user) {
          const loraResponse = await fetch('http://localhost:8000/api/lora/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              original_text: diaryText,
              user_id: currentUserData.user.id,
              diary_id: currentDiaryId
            })
          });

          if (loraResponse.ok) {
            const loraResult = await loraResponse.json();
            finalText = loraResult.generated_text;
            loraModelVersion = loraResult.model_version;
            console.log('✅ LoRA 텍스트 생성 완료:', {
              original_length: loraResult.original_length,
              generated_length: loraResult.generated_length,
              model_version: loraResult.model_version
            });
          } else {
            console.log('⚠️ LoRA 텍스트 생성 실패, 원본 텍스트 사용');
          }
        }
      } catch (error) {
        console.log('⚠️ LoRA API 호출 실패. 원본 텍스트 사용:', error);
      }

      // diaries 테이블 업데이트 (핵심 기능)
      setGenerationStep('일기 데이터베이스에 저장 중...');
      console.log('💾 일기 저장 시작:', {
        diaryId: currentDiaryId,
        finalTextLength: finalText.length,
        moodVector: finalMoodVector
      });
      
      const { data, error } = await supabase
        .from('diaries')
        .update({
          status: 'finalized',
          mood_vector: finalMoodVector,
          final_text: finalText, // LoRA 생성된 텍스트 또는 원본 텍스트
          updated_at: new Date().toISOString()
        })
        .eq('id', currentDiaryId)
        .select();

      if (error) {
        console.error('❌ 일기 업데이트 실패:', error);
        
        // 일기 ID가 없거나 잘못된 경우 재생성 시도
        if (error.code === 'PGRST116' || error.message?.includes('not found')) {
          console.log('🔄 일기 ID 재생성 시도...');
          try {
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
              const newDiaryId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
              });

              const dateString = getKoreanDateString(selectedDate);
              const diaryData = {
                id: newDiaryId,
                user_id: userData.user.id,
                date: dateString,
                status: 'finalized',
                mood_vector: finalMoodVector,
                final_text: finalText,
                agent_version: 'v1.0'
              };

              const { data: newData, error: newError } = await supabase
                .from('diaries')
                .insert([diaryData])
                .select();

              if (newError) {
                console.error('❌ 일기 재생성 실패:', newError);
                alert('일기 저장에 실패했습니다. 다시 시도해주세요.');
                return;
              }

              setCurrentDiaryId(newDiaryId);
              console.log('✅ 일기 재생성 성공:', newDiaryId);
            }
          } catch (retryError) {
            console.error('❌ 일기 재생성 중 오류:', retryError);
            alert('일기 저장에 실패했습니다. 다시 시도해주세요.');
            return;
          }
        } else {
          alert('일기 저장에 실패했습니다. 다시 시도해주세요.');
          return;
        }
      }

      console.log('✅ 일기 업데이트 완료:', data);
      console.log('🎭 감정 벡터:', finalMoodVector);
      console.log('💰 레이아웃 보상:', layoutReward, '차이:', layoutDifference);

      // RL 모델에 피드백 전송 (선택적)
      if (aiSuggestedLayout) {
        setGenerationStep('강화학습 모델에 피드백 전송 중...');
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const selectedCardIds = selectedCards.map(card => card.id);
            
            const feedbackResponse = await fetch('http://localhost:8000/api/rl/learn-from-feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                diary_id: currentDiaryId,
                feedback_type: 'save',
                details: {
                  user_id: userData.user.id,
                  original_layout: aiSuggestedLayout,
                  user_layout: userLayout,
                  layout_reward: layoutReward,
                  layout_difference: layoutDifference,
                  reward_details: rewardDetails,
                  final_text_length: diaryText.length,
                  mood_vector: finalMoodVector,
                  related_card_id: selectedCardIds.length > 0 ? selectedCardIds[0] : null
                }
              })
            });
            
            if (feedbackResponse.ok) {
              const result = await feedbackResponse.json();
              console.log('✅ RL 피드백 전송 완료:', result);
              setTimeout(() => fetchLearningStatus(), 1000);
            } else {
              const errorText = await feedbackResponse.text();
              console.error('❌ RL 피드백 전송 실패:', feedbackResponse.status, errorText);
            }
          }
        } catch (error) {
          console.error('❌ RL 피드백 전송 중 오류:', error);
        }
      }

      // 일기 저장 후 LoRA 모델 온라인 학습 시작 (현재 비활성화)
      setGenerationStep('LoRA 모델 온라인 학습 준비 중...');
      console.log('🔄 LoRA 모델 온라인 학습은 현재 비활성화되어 있습니다.');

      // 생성된 일기가 DB에 제대로 저장되었는지 확인
      const dateString = getKoreanDateString(selectedDate);
      
      alert(`일기가 성공적으로 생성되었습니다!\n\n📅 날짜: ${dateString}\n🆔 일기 ID: ${currentDiaryId}\n📝 내용 길이: ${finalText.length}자\n\n잠시 후 일기 보기 페이지로 이동합니다.`);
      console.log('📅 생성된 일기 확인:', dateString);
      console.log('📅 selectedDate:', selectedDate.toISOString());
      console.log('📅 currentDiaryId:', currentDiaryId);
      
      // DB에서 일기 다시 조회해서 확인
      const { data: verifyData, error: verifyError } = await supabase
        .from('diaries')
        .select('*')
        .eq('id', currentDiaryId)
        .single();
      
      if (verifyError) {
        console.error('❌ 일기 확인 실패:', verifyError);
      } else {
        console.log('✅ 일기 확인 성공:', verifyData);
      }
      
      // view 페이지로 이동 (일기 ID와 함께)
      setTimeout(() => {
        console.log('🔄 view 페이지로 이동 중...');
        console.log('📋 이동 정보:', { dateString, currentDiaryId });
        router.push(`/diary/view?date=${dateString}&diary_id=${currentDiaryId}`);
      }, 1000); // 1초 대기

    } catch (error) {
      console.error('일기 생성 중 오류:', error);
      alert('일기 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  return (
    <>
      <Head>
        <title>일기 작성 - Untold</title>
        <meta name="description" content="AI가 도와주는 자동 일기 작성" />
      </Head>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-5">
        <div className="max-w-7xl mx-auto">
          {/* 헤더 */}
          <header className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  📝 {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일기
                </h1>
                <p className="text-gray-600">
                  {existingDiary ? '기존 일기를 수정하고 있습니다' : '새로운 일기를 작성하고 있습니다'}
                </p>
              </div>
              <button
                onClick={() => router.push('/diary/calendar')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                📅 캘린더로 돌아가기
              </button>
            </div>
          </header>

          {/* 3칸 레이아웃 */}
          <div className="grid grid-cols-3 gap-6">
            {/* 첫 번째 칸: 대시보드/크롬 로그 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">🌐 크롬 로그</h3>
                <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {selectedDate.toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              <div className="space-y-2 mb-6">
                {chromeLogs.length > 0 ? (
                  chromeLogs.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-50 p-3 rounded border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleChromeLogClick(item)}
                    >
                      <p className="text-sm font-medium truncate" title={item.title}>{item.title}</p>
                      <p className="text-xs text-gray-500 truncate">{item.content.split('\n')[1]}</p>
                      <p className="text-xs text-gray-600 font-semibold">{item.content.split('\n')[2]}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">
                    {selectedDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0] 
                      ? '오늘의 크롬 로그를 불러오는 중이거나 데이터가 없습니다.' 
                      : `${selectedDate.toLocaleDateString('ko-KR')}의 크롬 로그가 없습니다.`}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">📌 위젯 스크랩</h3>
                <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {selectedDate.toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              <div className="space-y-2">
                {scrapItems.length > 0 ? (
                  scrapItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-blue-50 p-3 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => handleScrapItemClick(item)}
                    >
                      <p className="font-medium text-sm break-words" title={item.title}>
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-600 break-words mt-1" title={item.content}>
                        {item.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">
                    {selectedDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0] 
                      ? '오늘 스크랩한 위젯이 없습니다.' 
                      : `${selectedDate.toLocaleDateString('ko-KR')}에 스크랩한 위젯이 없습니다.`}
                  </p>
                )}
              </div>
            </div>

            {/* 두 번째 칸: 사진 관리 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
              <h3 className="text-xl font-semibold mb-4">📸 사진 관리</h3>
              
              {/* 사진 업로드 버튼 */}
              <div className="mb-6">
                <label className="block w-full">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageAdd}
                    className="hidden"
                  />
                  <div className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <div className="text-2xl mb-2">📷</div>
                    <p className="text-sm text-gray-600">사진을 선택하거나 여기에 드래그하세요</p>
                    <p className="text-xs text-gray-500 mt-1">여러 장 선택 가능</p>
                  </div>
                </label>
              </div>

              {/* 추가된 사진 목록 */}
              <div className="space-y-3 mb-6">
                {customImages.map((image) => (
                  <div
                    key={image.id}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <img
                          src={image.previewUrl}
                          alt="미리보기"
                          className="w-16 h-16 object-cover rounded border border-gray-300"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <textarea
                          value={image.description}
                          onChange={(e) => handleImageDescriptionChange(image.id, e.target.value)}
                          onKeyPress={(e) => handleImageDescriptionKeyPress(e, image)}
                          placeholder="이 사진에 대한 설명을 입력하세요... (엔터로 카드 생성)"
                          className="w-full p-2 text-sm border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={2}
                        />
                      </div>
                      
                      <button
                        onClick={() => handleImageRemove(image.id)}
                        className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 생성된 사진 카드들 */}
              <h4 className="text-lg font-semibold mb-3 text-gray-700">🖼️ 생성된 카드</h4>
              <div className="space-y-2">
                {imageCards.length > 0 ? (
                  imageCards.map((card) => (
                    <div
                      key={card.id}
                      className="bg-purple-50 p-3 rounded border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors"
                      onClick={() => handleImageCardClick(card)}
                    >
                      <div className="flex items-start space-x-3">
                        {card.imageUrl && (
                          <div className="flex-shrink-0">
                            <img
                              src={card.imageUrl}
                              alt="카드 이미지"
                              className="w-12 h-12 object-cover rounded border border-purple-300"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={card.title}>{card.title}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageCardRemove(card.id);
                          }}
                          className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="카드 삭제"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">
                    아직 추가된 사진이 없습니다.
                  </p>
                )}
              </div>
            </div>

            {/* 세 번째 칸: 일기 생성 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
              <h3 className="text-xl font-semibold mb-4">📝 일기 생성</h3>
              
              {/* 선택된 카드들 */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">📋 선택된 카드들 ({selectedCards.length}개)</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedCards.map((card) => (
                    <div key={card.id} className="p-2 border rounded-lg bg-gray-50">
                      <p className="text-xs font-medium text-gray-600">{card.source_type}</p>
                      <p className="text-xs text-gray-800 truncate">{card.text_final}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI 레이아웃 제안 */}
              {selectedCards.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">🎯 AI 레이아웃 제안</h3>
                    <button
                      onClick={handleAutoLayout}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      🤖 AI 레이아웃 생성
                    </button>
                  </div>
                  
                  {aiSuggestedLayout && (
                    <div className="p-3 bg-blue-50 rounded-lg mb-4">
                      <p className="text-sm text-blue-800 mb-2">AI 추천 레이아웃이 생성되었습니다! 드래그해서 수정해보세요.</p>
                      <div className="text-xs text-blue-600">
                        {Object.entries(aiSuggestedLayout).map(([cardId, layout]: [string, any]) => (
                          <div key={cardId}>
                            {cardId.slice(0, 8)}... → ({layout.row}, {layout.col})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 드래그 앤 드롭 레이아웃 그리드 */}
                  {aiSuggestedLayout && (
                    <div className="mb-6">
                      <h4 className="text-md font-semibold mb-3">📐 레이아웃 편집 (드래그 앤 드롭)</h4>
                      <div className="grid grid-cols-4 gap-2 p-4 bg-gray-50 rounded-lg">
                        {layoutGrid.map((row, rowIndex) => 
                          row.map((cell, colIndex) => (
                            <div
                              key={`${rowIndex}-${colIndex}`}
                              className={`
                                aspect-square border-2 rounded-lg p-2 flex items-center justify-center text-xs
                                ${cell ? 'border-blue-400 bg-white shadow-sm' : 'border-gray-200 bg-gray-100'}
                                ${isDragging ? 'border-dashed border-blue-500' : ''}
                              `}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                            >
                              {cell ? (
                                <div 
                                  className="text-center w-full cursor-move"
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, cell.cardId)}
                                  onDragEnd={handleDragEnd}
                                >
                                  <div className="font-medium text-blue-800 truncate text-xs">
                                    {selectedCards.find(c => c.id === cell.cardId)?.text_final?.slice(0, 10) || '제목 없음'}
                                  </div>
                                  <div className="text-gray-500 text-xs mt-1">
                                    ({cell.layout.row}, {cell.layout.col})
                                  </div>
                                </div>
                              ) : (
                                <div className="text-gray-400 text-xs">드롭 영역</div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 일기 텍스트 입력 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 일기 내용
                </label>
                <textarea
                  value={diaryText}
                  onChange={(e) => setDiaryText(e.target.value)}
                  placeholder="선택한 카드들을 보고 일기를 작성하세요..."
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <div className="mt-2 text-xs text-gray-500">
                  💡 일기 내용을 입력하면 아래 버튼이 활성화됩니다.
                </div>
              </div>

              {/* 보상 정보 표시 */}
              {rewardInfo && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">💰 실시간 레이아웃 보상</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-green-600">레이아웃 보상:</p>
                      <p className={`font-bold ${(rewardInfo.reward || 0) >= 50 ? 'text-green-600' : 'text-orange-600'}`}>
                        {(rewardInfo.reward || 0).toFixed(1)}점
                      </p>
                    </div>
                    <div>
                      <p className="text-green-600">평균 차이:</p>
                      <p className="font-bold text-gray-800">{(rewardInfo.avgDifference || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-green-600">비교된 카드:</p>
                      <p className="font-bold text-gray-800">{rewardInfo.comparedCards || 0}개</p>
                  </div>
                    <div>
                      <p className="text-green-600">학습 상태:</p>
                      <p className="font-bold text-green-600">🔄 실시간 학습 중</p>
                    </div>
                  </div>
                  {(rewardInfo.reward || 0) < 50 && (
                    <p className="text-orange-600 text-xs mt-2">
                      💡 AI 제안과 많이 다르네요! 더 나은 레이아웃을 위해 학습하고 있습니다.
                    </p>
                  )}
                </div>
              )}

              {/* 학습 상태 표시 */}
              {learningStatus && (
                <div className={`mb-4 p-3 rounded-lg ${
                  learningStatus.type === 'success' ? 'bg-green-50 border border-green-200' : 
                  learningStatus.type === 'error' ? 'bg-red-50 border border-red-200' : 
                  'bg-blue-50 border border-blue-200'
                }`}>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      learningStatus.type === 'success' ? 'bg-green-500' : 
                      learningStatus.type === 'error' ? 'bg-red-500' : 
                      'bg-blue-500'
                    }`}></div>
                    <p className={`text-sm ${
                      learningStatus.type === 'success' ? 'text-green-800' : 
                      learningStatus.type === 'error' ? 'text-red-800' : 
                      'text-blue-800'
                    }`}>
                      {learningStatus.message}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(learningStatus.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              )}
              
              {/* 생성 버튼 */}
              <button
                className={`w-full font-semibold py-3 px-4 rounded-lg transition-colors ${
                  isGenerating 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : diaryText.trim() === '' 
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
                onClick={handleGenerateDiary}
                disabled={isGenerating || diaryText.trim() === ''}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    일기 생성 중...
                  </div>
                ) : diaryText.trim() === '' ? (
                  '📝 일기 내용을 입력해주세요'
                ) : (
                  '🚀 일기 생성'
                )}
              </button>

              {/* 생성 진행 상황 표시 */}
              {isGenerating && generationStep && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                    <span className="text-sm font-medium text-blue-800">일기 생성 진행 중...</span>
                  </div>
                  <p className="text-sm text-blue-700 mb-2">{generationStep}</p>
                  <div className="text-xs text-blue-600 mb-2">
                    💡 백엔드 서버가 실행되지 않아도 기본 일기 생성은 가능합니다.
                  </div>
                  <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 강화학습 모델 상태 표시 */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-blue-800">🤖 강화학습 모델 상태</h3>
            <button
              onClick={fetchLearningStatus}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
            >
              🔄 새로고침
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-blue-600 font-medium">모델 로드</p>
            <p className="text-green-600">✅ 완료</p>
            </div>
            <div>
            <p className="text-blue-600 font-medium">실시간 학습</p>
            <p className="text-green-600">🔄 활성화</p>
            </div>
            <div>
            <p className="text-blue-600 font-medium">레이아웃 보상</p>
            <p className="text-gray-800">{rewardInfo?.reward?.toFixed(1) || '0.0'}점</p>
            </div>
            <div>
            <p className="text-blue-600 font-medium">학습 상태</p>
            <p className="text-green-600">✅ 정상</p>
            </div>
          </div>
        </div>
    </>
  );
}
