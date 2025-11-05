#!/bin/bash

echo "🚀 2D 감정 분석 모델 curl 테스트"
echo "=================================="

# 서버 상태 확인
echo "1. 서버 상태 확인..."
curl -s http://localhost:8000/health
echo -e "\n"

# ML API 테스트
echo "2. ML API 테스트..."
curl -s http://localhost:8000/api/ml/test
echo -e "\n"

# 감정 분석 테스트들
echo "3. 감정 분석 테스트..."

echo "📝 긍정적 텍스트 테스트:"
curl -X POST "http://localhost:8000/api/ml/sentiment" \
  -H "Content-Type: application/json" \
  -d '{"text": "오늘은 정말 행복한 하루였어요!"}' | jq .
echo -e "\n"

echo "📝 부정적 텍스트 테스트:"
curl -X POST "http://localhost:8000/api/ml/sentiment" \
  -H "Content-Type: application/json" \
  -d '{"text": "너무 슬프고 우울해요"}' | jq .
echo -e "\n"

echo "📝 분노 텍스트 테스트:"
curl -X POST "http://localhost:8000/api/ml/sentiment" \
  -H "Content-Type: application/json" \
  -d '{"text": "화가 나서 참을 수 없어요"}' | jq .
echo -e "\n"

echo "📝 평온한 텍스트 테스트:"
curl -X POST "http://localhost:8000/api/ml/sentiment" \
  -H "Content-Type: application/json" \
  -d '{"text": "평온하고 차분한 하루입니다"}' | jq .
echo -e "\n"

echo "📝 중립적 텍스트 테스트:"
curl -X POST "http://localhost:8000/api/ml/sentiment" \
  -H "Content-Type: application/json" \
  -d '{"text": "오늘 날씨가 그냥 그랬어요"}' | jq .
echo -e "\n"

echo "✅ 테스트 완료!" 