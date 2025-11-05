import React from 'react';

interface EmotionVector {
  x: number; // Valence (기쁨-슬픔): -1 ~ 1
  y: number; // Arousal (각성-이완): -1 ~ 1
}

interface EmotionBeadProps {
  emotionVector: EmotionVector;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode; // 구슬 안에 표시할 내용
}

export default function EmotionBead({ emotionVector, size = 'md', className = '', children }: EmotionBeadProps) {
  // 4가지 기본 감정 색상 정의 (밝고 맑은 색상)
  const emotionColors = {
    joy: { r: 255, g: 255, b: 150, name: '밝은 노랑' },      // 기쁨 (노랑)
    sadness: { r: 150, g: 200, b: 255, name: '밝은 파랑' },  // 슬픔 (파랑)
    arousal: { r: 255, g: 150, b: 150, name: '밝은 빨강' },  // 각성 (빨강)
    calm: { r: 150, g: 255, b: 150, name: '밝은 초록' }      // 이완 (초록)
  };

  // 감정 벡터를 4가지 색상의 조합으로 변환하는 함수 (빛의 가산 혼합)
  const vectorToColorMix = (vector: EmotionVector) => {
    const { x, y } = vector;
    
    // 각 축의 절댓값을 계산하여 색상 강도 결정
    const valenceStrength = Math.abs(x);
    const arousalStrength = Math.abs(y);
    
    // 각 색상의 가중치 계산
    let joyWeight = 0;      // 기쁨 (양의 valence)
    let sadnessWeight = 0;  // 슬픔 (음의 valence)
    let arousalWeight = 0;  // 각성 (양의 arousal)
    let calmWeight = 0;     // 이완 (음의 arousal)
    
    if (x > 0) {
      joyWeight = x;
    } else {
      sadnessWeight = Math.abs(x);
    }
    
    if (y > 0) {
      arousalWeight = y;
    } else {
      calmWeight = Math.abs(y);
    }
    
    // 총 가중치로 정규화
    const totalWeight = joyWeight + sadnessWeight + arousalWeight + calmWeight;
    if (totalWeight > 0) {
      joyWeight /= totalWeight;
      sadnessWeight /= totalWeight;
      arousalWeight /= totalWeight;
      calmWeight /= totalWeight;
    }
    
    // 빛의 가산 혼합 (RGB 값들을 더해서 밝아지도록)
    const r = Math.round(
      emotionColors.joy.r * joyWeight +
      emotionColors.sadness.r * sadnessWeight +
      emotionColors.arousal.r * arousalWeight +
      emotionColors.calm.r * calmWeight
    );
    
    const g = Math.round(
      emotionColors.joy.g * joyWeight +
      emotionColors.sadness.g * sadnessWeight +
      emotionColors.arousal.g * arousalWeight +
      emotionColors.calm.g * calmWeight
    );
    
    const b = Math.round(
      emotionColors.joy.b * joyWeight +
      emotionColors.sadness.b * sadnessWeight +
      emotionColors.arousal.b * arousalWeight +
      emotionColors.calm.b * calmWeight
    );
    
    // 빛이 섞일수록 밝아지는 효과를 위해 최대값을 255로 제한
    const maxValue = Math.max(r, g, b);
    if (maxValue > 255) {
      const scale = 255 / maxValue;
      return { 
        r: Math.round(r * scale), 
        g: Math.round(g * scale), 
        b: Math.round(b * scale), 
        joyWeight, sadnessWeight, arousalWeight, calmWeight 
      };
    }
    
    return { r, g, b, joyWeight, sadnessWeight, arousalWeight, calmWeight };
  };

  // 4방향 보간 기반 그라데이션 생성
  const generateEmotionGradient = (vector: EmotionVector): string => {
    const { x, y } = vector;
    
    // 4방향 색상 정의 (상하좌우)
    const directions = [
      { name: 'top', color: emotionColors.arousal, position: 'top center' },      // 위쪽: 빨강 (각성)
      { name: 'bottom', color: emotionColors.calm, position: 'bottom center' },   // 아래쪽: 초록 (이완)
      { name: 'left', color: emotionColors.sadness, position: 'left center' },    // 왼쪽: 파랑 (슬픔)
      { name: 'right', color: emotionColors.joy, position: 'right center' }       // 오른쪽: 노랑 (기쁨)
    ];
    
    // 각 방향의 강도 계산 (좌표 값에 따른 보간)
    const topStrength = Math.max(0, y);      // 위쪽 (양의 y) - 각성
    const bottomStrength = Math.max(0, -y);  // 아래쪽 (음의 y) - 이완
    const rightStrength = Math.max(0, x);    // 오른쪽 (양의 x) - 기쁨
    const leftStrength = Math.max(0, -x);    // 왼쪽 (음의 x) - 슬픔
    
    const strengths = [topStrength, bottomStrength, leftStrength, rightStrength];
    
    // 모든 강도가 0인 경우 (중립) - 흰색 투명
    if (strengths.every(s => s === 0)) {
      return `radial-gradient(circle at 50% 50%, 
        rgba(255, 255, 255, 0.15) 0%, 
        rgba(255, 255, 255, 0.08) 50%, 
        transparent 100%)`;
    }
    
    // 각 방향에서 색상이 보간되는 효과
    let gradientLayers = [];
    
    directions.forEach((direction, index) => {
      const strength = strengths[index];
      if (strength > 0.01) { // 최소 강도 이상일 때만
        const { color, position } = direction;
        
        gradientLayers.push(
          `radial-gradient(circle at ${position}, 
            rgba(${color.r}, ${color.g}, ${color.b}, ${0.6 * strength}) 0%, 
            rgba(${color.r}, ${color.g}, ${color.b}, ${0.4 * strength}) 30%, 
            rgba(${color.r}, ${color.g}, ${color.b}, ${0.2 * strength}) 60%, 
            rgba(${color.r}, ${color.g}, ${color.b}, ${0.05 * strength}) 85%, 
            transparent 100%)`
        );
      }
    });
    
    // 중앙에서 모든 색상이 섞이는 효과 (더 부드럽게)
    const centerMix = vectorToColorMix(vector);
    gradientLayers.push(
      `radial-gradient(circle at 50% 50%, 
        rgba(${centerMix.r}, ${centerMix.g}, ${centerMix.b}, 0.5) 0%, 
        rgba(${centerMix.r}, ${centerMix.g}, ${centerMix.b}, 0.25) 50%, 
        rgba(${centerMix.r}, ${centerMix.g}, ${centerMix.b}, 0.1) 80%, 
        transparent 100%)`
    );
    
    return gradientLayers.join(', ');
  };

  // 크기별 스타일 설정
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24'
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <div 
        className="w-full h-full rounded-full transition-all duration-300 hover:scale-110"
        style={{
          background: generateEmotionGradient(emotionVector),
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: `
            0 4px 16px rgba(0, 0, 0, 0.1),
            0 2px 8px rgba(0, 0, 0, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.3)
          `,
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* 사실적인 유리구슬 반사 효과 */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: `
              /* 메인 하이라이트 - 좌측 상단에서 시작, 부드럽게 페이드아웃 */
              radial-gradient(ellipse 60% 50% at 25% 20%, 
                rgba(255,255,255,0.9) 0%, 
                rgba(255,255,255,0.7) 15%, 
                rgba(255,255,255,0.4) 30%, 
                rgba(255,255,255,0.2) 45%, 
                rgba(255,255,255,0.05) 60%, 
                transparent 75%),
              /* 부드러운 전체 반사 - 구슬 전체에 걸쳐 자연스럽게 */
              radial-gradient(circle at 30% 25%, 
                rgba(255,255,255,0.4) 0%, 
                rgba(255,255,255,0.2) 25%, 
                rgba(255,255,255,0.1) 50%, 
                transparent 75%),
              /* 우측 하단 자연스러운 그림자 */
              radial-gradient(circle at 75% 80%, 
                rgba(0,0,0,0.08) 0%, 
                rgba(0,0,0,0.04) 30%, 
                rgba(0,0,0,0.02) 60%, 
                transparent 80%),
              /* 좌측 상단에서 우측 하단으로 이어지는 자연스러운 빛의 흐름 */
              linear-gradient(135deg, 
                rgba(255,255,255,0.2) 0%, 
                rgba(255,255,255,0.1) 20%, 
                rgba(255,255,255,0.05) 40%, 
                transparent 60%, 
                rgba(0,0,0,0.01) 80%)
            `,
          }}
        />
        
        {/* 좌측 상단 메인 하이라이트 */}
        <div 
          className="absolute top-1/8 left-1/8 w-1/3 h-1/4"
          style={{
            background: `
              radial-gradient(ellipse 100% 80%, 
                rgba(255,255,255,0.95) 0%, 
                rgba(255,255,255,0.8) 20%, 
                rgba(255,255,255,0.5) 40%, 
                rgba(255,255,255,0.2) 60%, 
                rgba(255,255,255,0.05) 80%, 
                transparent 100%)
            `,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
        
        {/* 우측 하단 부드러운 이차 반사 */}
        <div 
          className="absolute bottom-1/5 right-1/5 w-1/5 h-1/6"
          style={{
            background: `
              radial-gradient(ellipse 100% 80%, 
                rgba(255,255,255,0.4) 0%, 
                rgba(255,255,255,0.2) 30%, 
                rgba(255,255,255,0.1) 60%, 
                transparent 80%)
            `,
            borderRadius: '50%',
            transform: 'translate(50%, 50%)'
          }}
        />
        
        {/* 구슬 안에 표시할 내용 */}
        {children && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-gray-600 text-shadow-lg drop-shadow-lg">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 