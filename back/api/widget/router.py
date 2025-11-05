# api/widget/router.py
# 위젯 관련 API 라우터 모듈

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import uuid

from . import randomDog, advice, book, weather, news  
from .scrap import ScrapData, create_scrap, delete_scrap, check_scrap_exists
from db.connect import supabase


router = APIRouter(
    prefix="/widgets",
    tags=["Widgets"],
)

@router.get("/randomDog")
async def get_random_dog_widget_data():
    """랜덤 강아지 위젯 데이터를 반환합니다."""
    return await random_dog.get_random_dog_image()

@router.get("/advice")
async def get_advice_widget_data():
    """오늘의 명언 위젯 데이터를 반환합니다."""
    return await advice.get_random_advice()

@router.get("/book")
async def get_book_widget_data():
    """알라딘 신간 추천 리스트 위젯 데이터를 반환합니다."""
    return await book.get_new_book_list()

@router.get("/weather")
async def get_weather_widget_data():
    """날씨 정보 위젯 데이터를 반환합니다."""
    return await weather.get_weather_data()

@router.get("/news")
async def get_news_widget_data():
    """뉴스 정보 위젯 데이터를 반환합니다."""
    return await news.get_news_data()


# --- Supabase DB 연동 API ---
# 사용자가 설정한 위젯 목록을 관리

class UserWidget(BaseModel):
    widget_name: str
    position: int

@router.get("/user/{user_id}")
async def get_user_widgets(user_id: uuid.UUID):
    """특정 사용자가 설정한 위젯 목록과 순서를 DB에서 가져옵니다."""
    try:
        response = supabase.table('user_widgets').select('*').eq('user_id', str(user_id)).order('position').execute()
        
        if response.data:
            return response.data
        return [] # 설정된 위젯이 없으면 빈 리스트 반환
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/user/{user_id}")
async def set_user_widgets(user_id: uuid.UUID, widgets: List[UserWidget]):
    """사용자의 위젯 설정을 DB에 저장(업데이트)합니다."""
    try:
        # 1. 기존 위젯 설정을 모두 삭제합니다.
        supabase.table('user_widgets').delete().eq('user_id', str(user_id)).execute()

        # 2. 새로운 위젯 설정 목록을 한 번에 추가합니다.
        records_to_insert = [
            {
                "id": str(uuid.uuid4()), # 새 UUID 생성
                "user_id": str(user_id),
                "widget_name": w.widget_name,
                "position": w.position
            } for w in widgets
        ]
        
        if not records_to_insert:
             return {"message": "User widgets cleared successfully."}

        response = supabase.table('user_widgets').insert(records_to_insert).execute()

        if response.data:
            return response.data
        else:
            # Supabase v2부터는 insert 성공 시 error가 None이지만 data가 비어있을 수 있습니다.
            return {"message": "User widgets updated successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 스크랩 관련 API ---
@router.post("/scrap")
async def create_scrap_endpoint(scrap_data: ScrapData):
    """위젯을 스크랩합니다."""
    return await create_scrap(scrap_data)

@router.delete("/scrap")
async def delete_scrap_endpoint(user_id: str, source_type: str, category: str, content: str):
    """스크랩을 취소합니다."""
    return await delete_scrap(user_id, source_type, category, content)

@router.get("/scrap/check")
async def check_scrap_endpoint(user_id: str, source_type: str, category: str, content: str):
    """스크랩 상태를 확인합니다."""
    exists = await check_scrap_exists(user_id, source_type, category, content)
    return {"exists": exists}

@router.get("/scrap/list/{user_id}")
async def get_user_scraps(user_id: str, date: str = None):
    """사용자의 스크랩 목록을 가져옵니다."""
    try:
        print(f"🔍 스크랩 조회 요청: user_id={user_id}, date={date}")
        
        query = supabase.table('scraps').select('*').eq('user_id', user_id)
        
        # 날짜 필터링이 있는 경우
        if date:
            # 날짜 범위 설정 (해당 날짜의 00:00:00 ~ 23:59:59)
            from datetime import datetime, timedelta
            start_date = datetime.strptime(date, '%Y-%m-%d')
            end_date = start_date + timedelta(days=1)
            
            print(f"📅 날짜 필터링: {start_date.isoformat()} ~ {end_date.isoformat()}")
            print(f"📅 요청된 날짜: {date}")
            print(f"📅 시작 시간: {start_date.isoformat()}")
            print(f"📅 종료 시간: {end_date.isoformat()}")
            
            query = query.gte('scraped_at', start_date.isoformat())
            query = query.lt('scraped_at', end_date.isoformat())
        else:
            print("📅 날짜 필터링 없음 - 모든 스크랩 조회")
        
        response = query.order('scraped_at', desc=True).execute()
        
        print(f"📊 조회 결과: {len(response.data) if response.data else 0}개 스크랩")
        
        if response.data:
            return response.data
        return []
    except Exception as e:
        print(f"❌ 스크랩 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
