from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from chrome_db.models.chrome_logs import Base, ChromeLog
import os
from datetime import datetime

# 데이터베이스 URL 설정
# SQLite 사용 (간단한 파일형 DB)
DATABASE_URL = "sqlite:///./chrome_logs.db"

# 엔진 생성
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite용 설정
)

# 세션 팩토리 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 테이블 생성
def create_tables():
    """
    데이터베이스 테이블 생성
    """
    Base.metadata.create_all(bind=engine)
    print("✅ 크롬 로그 테이블이 생성되었습니다.")

# 데이터베이스 세션 의존성
def get_db():
    """
    데이터베이스 세션을 반환하는 함수
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 크롬 로그 저장 함수
def save_chrome_log(db, log_data):
    """
    크롬 익스텐션에서 받은 데이터를 데이터베이스에 저장
    """
    try:
        # ChromeLog 모델 인스턴스 생성
        chrome_log = ChromeLog(
            user_id=1,  # 임시 사용자 ID
            url=log_data.url,
            title=log_data.title,
            domain=log_data.domain,
            visit_time=datetime.fromisoformat(log_data.timestamp.replace('Z', '+00:00')), # Convert ISO string to datetime
            page_type=log_data.pageType,
            site_specific_data=log_data.siteSpecific
        )
        
        # 데이터베이스에 저장
        db.add(chrome_log)
        db.commit()
        db.refresh(chrome_log)
        
        print(f"✅ 크롬 로그 저장 성공: ID {chrome_log.id}")
        return chrome_log
        
    except Exception as e:
        db.rollback()
        print(f"❌ 크롬 로그 저장 실패: {str(e)}")
        raise e

# 🆕 사용시간 업데이트 함수
def update_chrome_log_duration(db, duration_data):
    """
    기존 크롬 로그의 duration 필드를 업데이트
    """
    try:
        # URL과 도메인으로 해당 로그 찾기
        chrome_log = db.query(ChromeLog).filter(
            ChromeLog.url == duration_data.url,
            ChromeLog.domain == duration_data.domain
        ).order_by(ChromeLog.created_at.desc()).first()
        
        if chrome_log:
            # duration 업데이트
            chrome_log.duration = duration_data.duration
            db.commit()
            db.refresh(chrome_log)
            
            print(f"✅ 사용시간 업데이트 성공: ID {chrome_log.id}, 체류시간 {duration_data.duration}초")
            return chrome_log
        else:
            print(f"⚠️ 해당 로그를 찾을 수 없음: {duration_data.url}")
            return None
            
    except Exception as e:
        db.rollback()
        print(f"❌ 사용시간 업데이트 실패: {str(e)}")
        raise e

# 저장된 로그 조회 함수
def get_chrome_logs(db, limit=10):
    """
    저장된 크롬 로그를 조회
    """
    try:
        logs = db.query(ChromeLog).order_by(ChromeLog.created_at.desc()).limit(limit).all()
        return [log.to_dict() for log in logs]
    except Exception as e:
        print(f"❌ 크롬 로그 조회 실패: {str(e)}")
        return [] 