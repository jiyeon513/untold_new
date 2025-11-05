from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class ChromeLog(Base):
    """
    크롬 익스텐션에서 수집한 웹 방문 로그를 저장하는 테이블
    """
    __tablename__ = "chrome_logs"
    
    # 기본 키
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 사용자 정보 (나중에 확장 가능)
    user_id = Column(Integer, nullable=True, default=1)
    
    # 기본 방문 정보
    url = Column(Text, nullable=False, comment="방문한 웹사이트 URL")
    title = Column(String(500), nullable=True, comment="웹페이지 제목")
    domain = Column(String(255), nullable=False, comment="도메인")
    
    # 시간 정보
    visit_time = Column(DateTime, nullable=False, comment="방문 시간")
    created_at = Column(DateTime, default=datetime.utcnow, comment="데이터 생성 시간")
    
    # 페이지 유형
    page_type = Column(String(100), nullable=False, comment="페이지 유형 (youtube_video, naver_news 등)")
    
    # 사이트별 특화 정보 (JSON 형태로 저장)
    site_specific_data = Column(JSON, nullable=True, comment="사이트별 특화 정보 (영상 제목, 채널명 등)")
    
    # 추가 정보 (나중에 확장 가능)
    duration = Column(Integer, nullable=True, comment="체류 시간 (초)")
    category = Column(String(100), nullable=True, comment="카테고리")
    
    def __repr__(self):
        return f"<ChromeLog(id={self.id}, url='{self.url}', page_type='{self.page_type}')>"
    
    def to_dict(self):
        """
        모델을 딕셔너리로 변환
        """
        return {
            "id": self.id,
            "user_id": self.user_id,
            "url": self.url,
            "title": self.title,
            "domain": self.domain,
            "visit_time": self.visit_time.isoformat() if self.visit_time else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "page_type": self.page_type,
            "site_specific_data": self.site_specific_data,
            "duration": self.duration,
            "category": self.category
        }
