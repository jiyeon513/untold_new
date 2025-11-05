import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Navigation from '@/components/Navigation';

interface EmotionVector {
  x: number; // Valence (기쁨-슬픔): -1 ~ 1
  y: number; // Arousal (각성-이완): -1 ~ 1
}

interface EmotionColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export default function EmotionVisualizer() {
  const [emotionVector, setEmotionVector] = useState<EmotionVector>({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

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

  // 감정 영역 설명
  const getEmotionDescription = (vector: EmotionVector): string => {
    const { x, y } = vector;
    
    if (x > 0.5 && y > 0.5) return "기쁨 (Joy)";
    if (x > 0.5 && y < -0.5) return "평온 (Calm)";
    if (x < -0.5 && y > 0.5) return "분노 (Anger)";
    if (x < -0.5 && y < -0.5) return "슬픔 (Sadness)";
    if (x > 0.5 && Math.abs(y) < 0.5) return "만족 (Contentment)";
    if (x < -0.5 && Math.abs(y) < 0.5) return "불만 (Dissatisfaction)";
    if (Math.abs(x) < 0.5 && y > 0.5) return "흥분 (Excitement)";
    if (Math.abs(x) < 0.5 && y < -0.5) return "지루함 (Boredom)";
    
    return "중립 (Neutral)";
  };

  // 샘플 감정들
  const sampleEmotions = [
    { name: "기쁨", vector: { x: 0.8, y: 0.6 } },
    { name: "평온", vector: { x: 0.7, y: -0.5 } },
    { name: "슬픔", vector: { x: -0.8, y: -0.7 } },
    { name: "분노", vector: { x: -0.6, y: 0.8 } },
    { name: "흥분", vector: { x: 0.2, y: 0.9 } },
    { name: "지루함", vector: { x: -0.3, y: -0.8 } },
  ];

  const handleEmotionClick = (vector: EmotionVector) => {
    setIsAnimating(true);
    setEmotionVector(vector);
    
    // 애니메이션 완료 후 상태 리셋
    setTimeout(() => {
      setIsAnimating(false);
    }, 1000);
  };

  return (
    <>
      <Head>
        <title>감정 시각화 - Untold</title>
        <meta name="description" content="러셀의 감정 2차원 벡터 기반 감정 시각화" />
      </Head>
      <Navigation />
      
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <div className="max-w-6xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">감정 시각화</h1>
            <p className="text-lg text-gray-600">
              러셀의 감정 2차원 벡터를 기반으로 한 감정 표현
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* 감정 구슬 시각화 */}
            <div className="flex flex-col items-center">
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">
                  감정 구슬
                </h2>
                <div className="text-center mb-4">
                  <p className="text-gray-600 mb-2">
                    현재 감정: <span className="font-semibold text-blue-600">
                      {getEmotionDescription(emotionVector)}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">
                    좌표: ({emotionVector.x.toFixed(2)}, {emotionVector.y.toFixed(2)})
                  </p>
                  <div className="mt-2 flex justify-center space-x-2">
                    {(() => {
                      const { x, y } = emotionVector;
                      
                      // 4방향 강도 계산
                      const topStrength = Math.max(0, y);      // 위쪽 (기쁨)
                      const bottomStrength = Math.max(0, -y);  // 아래쪽 (슬픔)
                      const rightStrength = Math.max(0, x);    // 오른쪽 (각성)
                      const leftStrength = Math.max(0, -x);    // 왼쪽 (이완)
                      
                      const directions = [
                        { name: '기쁨', strength: topStrength, color: emotionColors.joy, position: '위쪽' },
                        { name: '슬픔', strength: bottomStrength, color: emotionColors.sadness, position: '아래쪽' },
                        { name: '이완', strength: leftStrength, color: emotionColors.calm, position: '왼쪽' },
                        { name: '각성', strength: rightStrength, color: emotionColors.arousal, position: '오른쪽' }
                      ].filter(d => d.strength > 0.01);
                      
                      return directions.map((d, index) => (
                        <div key={index} className="flex items-center space-x-1">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `rgb(${d.color.r}, ${d.color.g}, ${d.color.b})` }}
                          />
                          <span className="text-xs text-gray-600">
                            {d.position} {(d.strength * 100).toFixed(0)}%
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

                              {/* 감정 구슬 */}
                <div className="relative">
                  <div 
                    className={`w-64 h-64 rounded-full transition-all duration-1000 ${
                      isAnimating ? 'scale-110' : 'scale-100'
                    }`}
                    style={{
                      background: generateEmotionGradient(emotionVector),
                      backdropFilter: 'blur(15px)',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: `
                        0 8px 32px rgba(0, 0, 0, 0.1),
                        0 4px 16px rgba(0, 0, 0, 0.05),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2)
                      `,
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    {/* 사실적인 유리구슬 반사 효과 - 구슬 내부에만 제한 */}
                    <div 
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `
                          /* 메인 하이라이트 - 좌측 상단에서 시작, 부드럽게 페이드아웃 */
                          radial-gradient(ellipse 100px 80px at 25% 20%, 
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
                    
                    {/* 좌측 상단 메인 하이라이트 - 부드럽게 페이드아웃 */}
                    <div 
                      className="absolute top-1/8 left-1/8 w-24 h-20"
                      style={{
                        background: `
                          radial-gradient(ellipse 120px 100px, 
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
                      className="absolute bottom-1/5 right-1/5 w-16 h-12"
                      style={{
                        background: `
                          radial-gradient(ellipse 80px 60px, 
                            rgba(255,255,255,0.4) 0%, 
                            rgba(255,255,255,0.2) 30%, 
                            rgba(255,255,255,0.1) 60%, 
                            transparent 80%)
                        `,
                        borderRadius: '50%',
                        transform: 'translate(50%, 50%)'
                      }}
                    />
                    
                    {/* 중간 영역 미세한 반사 */}
                    <div 
                      className="absolute top-1/3 right-1/3 w-10 h-8"
                      style={{
                        background: `
                          radial-gradient(ellipse 50px 40px, 
                            rgba(255,255,255,0.3) 0%, 
                            rgba(255,255,255,0.15) 40%, 
                            rgba(255,255,255,0.05) 70%, 
                            transparent 90%)
                        `,
                        borderRadius: '50%',
                        transform: 'translate(50%, -50%)'
                      }}
                    />
                  </div>
                </div>
            </div>

            {/* 감정 선택 패널 */}
            <div className="flex flex-col">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">감정 선택</h2>
              
              {/* 샘플 감정 버튼들 */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {sampleEmotions.map((emotion, index) => (
                  <button
                    key={index}
                    onClick={() => handleEmotionClick(emotion.vector)}
                    className={`p-4 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                      emotionVector.x === emotion.vector.x && emotionVector.y === emotion.vector.y
                        ? 'ring-2 ring-blue-500 ring-offset-2'
                        : 'hover:shadow-lg'
                    }`}
                    style={{
                      background: generateEmotionGradient(emotion.vector),
                    }}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">
                        {emotion.name === "기쁨" && "😊"}
                        {emotion.name === "평온" && "😌"}
                        {emotion.name === "슬픔" && "😔"}
                        {emotion.name === "분노" && "😠"}
                        {emotion.name === "흥분" && "🤩"}
                        {emotion.name === "지루함" && "😐"}
                      </div>
                      <div className="font-semibold text-white text-shadow">
                        {emotion.name}
                      </div>
                      <div className="text-xs text-white/80">
                        ({emotion.vector.x.toFixed(1)}, {emotion.vector.y.toFixed(1)})
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* 커스텀 감정 입력 */}
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">커스텀 감정</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valence (기쁨-슬픔): {emotionVector.x.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={emotionVector.x}
                      onChange={(e) => setEmotionVector(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>슬픔 (-1)</span>
                      <span>중립 (0)</span>
                      <span>기쁨 (1)</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Arousal (각성-이완): {emotionVector.y.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={emotionVector.y}
                      onChange={(e) => setEmotionVector(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>이완 (-1)</span>
                      <span>중립 (0)</span>
                      <span>각성 (1)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 감정 영역 설명 */}
          <div className="mt-12 bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">감정 색상 시스템</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">4가지 기본 감정 색상</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'rgb(255, 255, 150)' }}></div>
                    <span className="text-sm text-gray-600">기쁨 (밝은 노랑) - 양의 Valence</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'rgb(150, 200, 255)' }}></div>
                    <span className="text-sm text-gray-600">슬픔 (밝은 파랑) - 음의 Valence</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'rgb(255, 150, 150)' }}></div>
                    <span className="text-sm text-gray-600">각성 (밝은 빨강) - 양의 Arousal</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'rgb(150, 255, 150)' }}></div>
                    <span className="text-sm text-gray-600">이완 (밝은 초록) - 음의 Arousal</span>
                  </div>
                </div>
              </div>
                              <div>
                  <h4 className="font-semibold text-gray-700 mb-3">빛의 가산 혼합 시스템</h4>
                  <p className="text-gray-600 text-sm mb-3">
                    색상이 아닌 빛의 개념으로, 색이 섞일수록 밝아지는 RGB 가산 혼합을 사용합니다.
                  </p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>• 위쪽: 기쁨 (밝은 노랑) - 양의 Y값</p>
                    <p>• 아래쪽: 슬픔 (밝은 파랑) - 음의 Y값</p>
                    <p>• 왼쪽: 이완 (밝은 초록) - 음의 X값</p>
                    <p>• 오른쪽: 각성 (밝은 빨강) - 양의 X값</p>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(45deg, #3b82f6, #8b5cf6);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(45deg, #3b82f6, #8b5cf6);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        
        .text-shadow {
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </>
  );
}
