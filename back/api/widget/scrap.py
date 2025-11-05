# back/api/widget/scrap.py
# 스크랩 관련 API 함수들

from fastapi import HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

from db.connect import supabase

class ScrapData(BaseModel):
    user_id: str
    source_type: str
    category: str
    content: str
    image_url: Optional[str] = None

async def create_scrap(scrap_data: ScrapData):
    """새로운 스크랩을 생성합니다."""
    try:
        scrap_record = {
            "id": str(uuid.uuid4()),
            "user_id": scrap_data.user_id,
            "source_type": scrap_data.source_type,
            "category": scrap_data.category,
            "content": scrap_data.content,
            "image_url": scrap_data.image_url,
            "scraped_at": datetime.now().isoformat(),
            "converted_to_card": False,
            "linked_diary_id": None
        }
        
        response = supabase.table('scraps').insert(scrap_record).execute()
        
        if response.data:
            return {"success": True, "scrap_id": scrap_record["id"]}
        else:
            raise HTTPException(status_code=500, detail="스크랩 생성 실패")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def delete_scrap(user_id: str, source_type: str, category: str, content: str):
    """특정 스크랩을 삭제합니다."""
    try:
        response = supabase.table('scraps').delete().eq('user_id', user_id).eq('source_type', source_type).eq('category', category).eq('content', content).execute()
        
        return {"success": True, "deleted": True}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def check_scrap_exists(user_id: str, source_type: str, category: str, content: str):
    """특정 스크랩이 이미 존재하는지 확인합니다."""
    try:
        response = supabase.table('scraps').select('id').eq('user_id', user_id).eq('source_type', source_type).eq('category', category).eq('content', content).execute()
        
        return len(response.data) > 0
        
    except Exception as e:
        return False 