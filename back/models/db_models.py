# back/models/db_models.py

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

# Users 테이블
class User(BaseModel):
    id: uuid.UUID
    kakao_id: Optional[str] = None
    nickname: Optional[str] = None
    # rl_env.py에서 사용할 필드들
    average_satisfaction: Optional[float] = 0.5
    total_diaries: Optional[int] = 0

# Diaries 테이블
class Diary(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    date: datetime
    emotion_vector: Optional[List[float]] = None
    reward_total: Optional[float] = None
    reward_breakdown: Optional[Dict[str, float]] = None
    created_at: datetime

# Cards 테이블 (새로운 DB 스키마에 맞게 수정)
class Card(BaseModel):
    id: uuid.UUID
    diary_id: uuid.UUID
    source_type: str  # widget, image, text 등
    category: str     # weather, quote, book 등
    content: Optional[str] = None
    image_url: Optional[str] = None
    layout_type: Optional[str] = None  # text, image, quote, combo
    row: Optional[int] = None
    col: Optional[int] = None
    order_index: Optional[int] = None
    text_generated: Optional[bool] = False  # AI가 자동 생성한 텍스트인지 여부
    text_final: Optional[str] = None  # 최종 사용자에게 보여지는 텍스트
    created_at: datetime

# Reward Logs 테이블 (새로 추가)
class RewardLog(BaseModel):
    id: uuid.UUID
    diary_id: uuid.UUID
    related_card_id: Optional[uuid.UUID] = None
    reward_type: str
    reward_value: float
    step: Optional[int] = None
    created_at: datetime

# Layout Logs 테이블 (새로 추가)
class LayoutLog(BaseModel):
    id: uuid.UUID
    diary_id: uuid.UUID
    card_id: uuid.UUID
    prev_row: Optional[int] = None
    prev_col: Optional[int] = None
    new_row: Optional[int] = None
    new_col: Optional[int] = None
    step: Optional[int] = None
    created_at: datetime
    moved_by_user: Optional[bool] = False

# Chrome Logs 테이블 (실제 DB 스키마에 맞게 수정)
class ChromeLog(BaseModel):
    id: int  # int8로 수정
    user_id: uuid.UUID  # Integer가 아닌 uuid로 수정
    url: str
    title: Optional[str] = None
    domain: str
    visit_time: datetime
    duration: Optional[int] = None
    category: Optional[str] = None
    created_at: datetime
    page_type: Optional[str] = None  # 새로 추가
    site_specific_data: Optional[Dict[str, Any]] = None  # 새로 추가

# User Widgets 테이블
class UserWidget(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    widget_name: str
    position: Optional[int] = None