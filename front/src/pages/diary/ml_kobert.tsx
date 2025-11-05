import axiosInstance from '@/api/axiosInstance';

const fetchSentiment = async (text: string) => {
  try {
    const response = await axiosInstance.post('/api/ml/sentiment', { text });
    console.log('감정 분석 결과:', response.data);
    // 예: { label: 'positive', score: 0.99... }
    return response.data;
  } catch (error) {
    console.error('감정 분석 API 호출 실패:', error);
    // API 호출 실패 시 기본값 반환
    return {
      valence: 0.0,
      arousal: 0.0,
      emotion_label: 'neutral',
      confidence: 0.0
    };
  }
};

export default fetchSentiment;