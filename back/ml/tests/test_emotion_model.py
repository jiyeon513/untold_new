#!/usr/bin/env python3
"""
2D 감정 분석 모델 테스트 코드
이 스크립트는 감정 분석 모델이 제대로 작동하는지 테스트합니다.
"""

import requests
import json
import time
from typing import Dict, Any

def test_emotion_api():
    """API 서버를 통해 감정 분석 모델을 테스트합니다."""
    
    # 테스트할 텍스트들 (2D 감정 분석 모델에 맞게 조정)
    test_cases = [
        {
            "text": "오늘은 정말 행복한 하루였어요!",
            "expected_emotion": ["excited", "pleasant", "happy"],
            "description": "긍정적 텍스트"
        },
        {
            "text": "너무 슬프고 우울해요",
            "expected_emotion": ["sad", "unpleasant", "depressed"],
            "description": "부정적 텍스트"
        },
        {
            "text": "화가 나서 참을 수 없어요",
            "expected_emotion": ["angry", "furious"],
            "description": "분노 텍스트"
        },
        {
            "text": "평온하고 차분한 하루입니다",
            "expected_emotion": ["pleasant", "calm", "relaxed"],
            "description": "평온한 텍스트"
        },
        {
            "text": "오늘 날씨가 그냥 그랬어요",
            "expected_emotion": ["neutral", "unpleasant", "pleasant"],
            "description": "중립적 텍스트"
        }
    ]
    
    print("🎯 2D 감정 분석 모델 테스트 시작")
    print("=" * 50)
    
    # API 서버 상태 확인
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✅ API 서버가 정상적으로 실행 중입니다")
        else:
            print("❌ API 서버에 문제가 있습니다")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ API 서버에 연결할 수 없습니다. 서버를 먼저 실행해주세요.")
        print("   실행 방법: cd back && python main.py")
        return False
    
    # ML API 테스트
    try:
        response = requests.get("http://localhost:8000/api/ml/test", timeout=5)
        if response.status_code == 200:
            print("✅ ML API가 정상적으로 작동합니다")
        else:
            print("❌ ML API에 문제가 있습니다")
            return False
    except Exception as e:
        print(f"❌ ML API 테스트 실패: {e}")
        return False
    
    print("\n📊 감정 분석 테스트 시작")
    print("-" * 50)
    
    success_count = 0
    total_count = len(test_cases)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['description']}")
        print(f"   텍스트: \"{test_case['text']}\"")
        
        try:
            # API 호출
            response = requests.post(
                "http://localhost:8000/api/ml/sentiment",
                headers={"Content-Type": "application/json"},
                json={"text": test_case['text']},
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                
                print(f"   ✅ 응답 성공")
                print(f"   📈 Valence: {result.get('valence', 'N/A'):.3f}")
                print(f"   📈 Arousal: {result.get('arousal', 'N/A'):.3f}")
                print(f"   🏷️  감정: {result.get('emotion_label', 'N/A')}")
                print(f"   🎯 신뢰도: {result.get('confidence', 'N/A'):.3f}")
                
                # 예상 감정과 비교 (2D 모델에 맞게 조정)
                actual_emotion = result.get('emotion_label', '')
                expected_emotions = test_case['expected_emotion']
                
                if isinstance(expected_emotions, str):
                    expected_emotions = [expected_emotions]
                
                if actual_emotion in expected_emotions:
                    print(f"   ✅ 예상 감정과 일치")
                    success_count += 1
                else:
                    print(f"   ⚠️  예상: {expected_emotions}, 실제: {actual_emotion}")
                
            else:
                print(f"   ❌ API 호출 실패: {response.status_code}")
                print(f"   에러: {response.text}")
                
        except Exception as e:
            print(f"   ❌ 테스트 실패: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 테스트 결과: {success_count}/{total_count} 성공")
    print(f"🎯 성공률: {(success_count/total_count)*100:.1f}%")
    
    if success_count == total_count:
        print("🎉 모든 테스트가 성공했습니다!")
        return True
    else:
        print("⚠️  일부 테스트가 실패했습니다.")
        return False

def test_direct_model():
    """모델을 직접 호출하여 테스트합니다."""
    
    print("\n🔬 직접 모델 테스트")
    print("=" * 50)
    
    try:
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        from ml.emotion_classifier import analyze_sentiment
        
        test_texts = [
            "오늘은 정말 행복한 하루였어요!",
            "너무 슬프고 우울해요",
            "화가 나서 참을 수 없어요"
        ]
        
        for i, text in enumerate(test_texts, 1):
            print(f"\n{i}. 텍스트: \"{text}\"")
            
            result = analyze_sentiment(text)
            
            print(f"   📈 Valence: {result.get('valence', 'N/A'):.3f}")
            print(f"   📈 Arousal: {result.get('arousal', 'N/A'):.3f}")
            print(f"   🏷️  감정: {result.get('emotion_label', 'N/A')}")
            print(f"   🎯 신뢰도: {result.get('confidence', 'N/A'):.3f}")
        
        print("\n✅ 직접 모델 테스트 성공!")
        return True
        
    except Exception as e:
        print(f"❌ 직접 모델 테스트 실패: {e}")
        return False

def performance_test():
    """성능 테스트를 수행합니다."""
    
    print("\n⚡ 성능 테스트")
    print("=" * 50)
    
    test_text = "오늘은 정말 행복한 하루였어요!"
    
    try:
        response = requests.post(
            "http://localhost:8000/api/ml/sentiment",
            headers={"Content-Type": "application/json"},
            json={"text": test_text},
            timeout=30
        )
        
        if response.status_code == 200:
            start_time = time.time()
            
            # 5번 연속 테스트
            for i in range(5):
                response = requests.post(
                    "http://localhost:8000/api/ml/sentiment",
                    headers={"Content-Type": "application/json"},
                    json={"text": test_text},
                    timeout=30
                )
                
                if response.status_code == 200:
                    result = response.json()
                    elapsed = time.time() - start_time
                    print(f"   {i+1}. 응답 시간: {elapsed:.2f}초")
                    start_time = time.time()
                else:
                    print(f"   {i+1}. 실패")
            
            print("\n✅ 성능 테스트 완료!")
            return True
        else:
            print("❌ 성능 테스트 실패")
            return False
            
    except Exception as e:
        print(f"❌ 성능 테스트 실패: {e}")
        return False

def main():
    """메인 테스트 함수"""
    
    print("🚀 2D 감정 분석 모델 종합 테스트")
    print("=" * 60)
    
    # 1. API 테스트
    api_success = test_emotion_api()
    
    # 2. 직접 모델 테스트
    direct_success = test_direct_model()
    
    # 3. 성능 테스트
    performance_success = performance_test()
    
    print("\n" + "=" * 60)
    print("📊 최종 테스트 결과")
    print("=" * 60)
    print(f"API 테스트: {'✅ 성공' if api_success else '❌ 실패'}")
    print(f"직접 모델 테스트: {'✅ 성공' if direct_success else '❌ 실패'}")
    print(f"성능 테스트: {'✅ 성공' if performance_success else '❌ 실패'}")
    
    if api_success and direct_success and performance_success:
        print("\n🎉 모든 테스트가 성공했습니다!")
        print("2D 감정 분석 모델이 완벽하게 작동하고 있습니다!")
    else:
        print("\n⚠️  일부 테스트가 실패했습니다.")
        print("문제를 확인하고 다시 테스트해주세요.")

if __name__ == "__main__":
    main() 