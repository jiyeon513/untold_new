// front/src/hooks/useScrap.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import axios from 'axios';

interface ScrapData {
  user_id: string;
  source_type: string;
  category: string;
  content: string;
  image_url?: string;
}

export const useScrap = (sourceType: string, category: string, content: string) => {
  const [isScrapped, setIsScrapped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // 사용자 ID 가져오기
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

  // 스크랩 상태 확인
  useEffect(() => {
    const checkScrapStatus = async () => {
      if (!userId) return;
      
      try {
        const response = await axios.get(`/api/widgets/scrap/check`, {
          params: {
            user_id: userId,
            source_type: sourceType,
            category: category,
            content: content
          }
        });
        setIsScrapped(response.data.exists);
      } catch (error) {
        console.error('스크랩 상태 확인 실패:', error);
      }
    };

    checkScrapStatus();
  }, [userId, sourceType, category, content]);

  // 스크랩 토글
  const toggleScrap = async () => {
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsLoading(true);
    
    try {
      if (isScrapped) {
        // 스크랩 취소
        await axios.delete(`/api/widgets/scrap`, {
          params: {
            user_id: userId,
            source_type: sourceType,
            category: category,
            content: content
          }
        });
        setIsScrapped(false);
      } else {
        // 스크랩 추가
        const scrapData: ScrapData = {
          user_id: userId,
          source_type: sourceType,
          category: category,
          content: content
        };
        
        await axios.post(`/api/widgets/scrap`, scrapData);
        setIsScrapped(true);
      }
    } catch (error) {
      console.error('스크랩 토글 실패:', error);
      alert('스크랩 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isScrapped,
    isLoading,
    toggleScrap
  };
}; 