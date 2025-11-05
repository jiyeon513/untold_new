# back/api/ml_router.py
from fastapi import APIRouter
from pydantic import BaseModel
from ml.emotion_classifier import analyze_sentiment

router = APIRouter(
    prefix="/ml",
    tags=["Machine Learning"],
)

# 요청 시 받을 데이터 형식을 정의
class SentimentRequest(BaseModel):
    text: str

@router.post("/sentiment")
async def get_sentiment(request: SentimentRequest):
    """텍스트를 받아 감성 분석 결과를 반환"""
    return analyze_sentiment(request.text)

@router.get("/test")
async def test():
    return {"message": "ML API is working!"}