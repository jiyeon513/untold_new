from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import uuid
import json # json 모듈 추가

# Supabase 연결 모듈 import (동업자 스타일)
from db.connect import supabase

# 라우터 생성
chrome_router = APIRouter()

def clean_text(text):
    """텍스트에서 특수문자를 제거하는 함수"""
    if not text:
        return text

    # 문제가 될 수 있는 문자들을 제거
    replacements = {
        '\u2014': '-',  # em dash
        '\u2013': '-',  # en dash
        '\u2018': "'",  # left single quotation mark
        '\u2019': "'",  # right single quotation mark
        '\u201c': '"',  # left double quotation mark
        '\u201d': '"',  # right double quotation mark
        '\u2026': '...',  # horizontal ellipsis
    }

    cleaned = str(text)
    for old, new in replacements.items():
        cleaned = cleaned.replace(old, new)

    return cleaned

def clean_nested_dict(data):
    """
    딕셔너리 또는 리스트 내의 모든 문자열 값에 clean_text를 재귀적으로 적용하는 함수
    """
    if isinstance(data, dict):
        return {k: clean_nested_dict(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_nested_dict(elem) for elem in data]
    elif isinstance(data, str):
        return clean_text(data)
    else:
        return data

# 데이터 모델 정의
class ChromeLogData(BaseModel):
    url: str
    title: str
    domain: str
    timestamp: str
    pageType: str
    siteSpecific: Dict[str, Any]
    visitStartTime: Optional[int] = None
    currentTime: Optional[int] = None
    user_id: Optional[str] = None  # 사용자 ID 추가

# 사용시간 업데이트용 데이터 모델
class DurationUpdateData(BaseModel):
    url: str
    domain: str
    visitStartTime: int
    visitEndTime: int
    duration: int
    user_id: Optional[str] = None  # 사용자 ID 추가

# /log_url 엔드포인트 구현
@chrome_router.post("/log_url")
async def log_url(data: ChromeLogData):
    """
    크롬 익스텐션에서 보낸 URL 로그를 받아서 처리하고 DB에 저장
    """
    try:
        # 받은 데이터 로그 출력
        print(f"📥 크롬 익스텐션에서 데이터 수신:")
        print(f"  - URL: {data.url}")
        print(f"  - 제목: {data.title}")
        print(f"  - 도메인: {data.domain}")
        print(f"  - 페이지 유형: {data.pageType}")
        print(f"  - 사이트별 정보: {data.siteSpecific}")
        if data.visitStartTime:
            print(f"  - 방문 시작 시간: {datetime.fromtimestamp(data.visitStartTime/1000).strftime('%H:%M:%S')}")

        # 사용자 ID 처리
        user_id = data.user_id
        if not user_id:
            print("⚠️ 사용자 ID가 제공되지 않았습니다. 기본값 사용")
            user_id = "980081c4-b1f4-45d5-b14a-cf82a7f166e5"  # 기본값
        else:
            print(f"✅ 사용자 ID 사용: {user_id}")

        # Supabase에 저장할 데이터 준비 (특수문자 제거 및 중첩 딕셔너리 처리)
        # site_specific_data는 Supabase의 'jsonb' 컬럼 타입에 맞춰 딕셔너리 형태로 전달합니다.
        # Supabase 클라이언트가 내부적으로 JSON 직렬화를 처리할 것입니다.
        cleaned_site_specific_data = clean_nested_dict(data.siteSpecific)

        chrome_log_data = {
            "user_id": user_id,
            "url": clean_text(data.url),
            "title": clean_text(data.title) if data.title else "제목 없음",
            "domain": clean_text(data.domain),
            "page_type": clean_text(data.pageType),
            "site_specific_data": cleaned_site_specific_data, # 딕셔너리 형태로 전달 (jsonb 컬럼 가정)
            "visit_time": data.timestamp.replace('Z', '+00:00'),
            "created_at": datetime.now().isoformat(),
            "duration": 0  # 초기값을 0으로 설정
        }

        # 디버깅을 위해 Supabase 삽입 전 데이터 출력
        print(f"DEBUG: Data before Supabase insert: {repr(chrome_log_data)}")

        # Supabase에 저장 (동업자 스타일)
        response = supabase.table('chrome_logs').insert(chrome_log_data).execute()

        if response.data:
            saved_log = response.data[0]
            print(f"✅ 크롬 로그 저장 성공: ID {saved_log['id']}")

            # 성공 응답
            return {
                "success": True,
                "message": "URL 로그가 성공적으로 저장되었습니다.",
                "data": {
                    "id": saved_log["id"],
                    "url": data.url,
                    "title": data.title,
                    "domain": data.domain,
                    "page_type": data.pageType,
                    "site_specific_data": data.siteSpecific, # 원본 데이터 반환
                    "timestamp": data.timestamp,
                    "created_at": datetime.now().isoformat()
                }
            }
        else:
            raise Exception("Supabase 저장 실패: 응답 데이터 없음")

    except UnicodeEncodeError as unicode_e:
        # UnicodeEncodeError를 명시적으로 잡아서 더 자세한 정보 출력
        print(f"❌ UnicodeEncodeError 발생:")
        print(f"  - 인코딩: {unicode_e.encoding}")
        print(f"  - 원인: {unicode_e.reason}")
        print(f"  - 실패한 객체: {repr(unicode_e.object)}")
        print(f"  - 위치: {unicode_e.start}-{unicode_e.end}")
        raise HTTPException(
            status_code=500,
            detail=f"서버 내부 오류: 인코딩 문제 발생 - {unicode_e.reason} (문자열: {repr(unicode_e.object[unicode_e.start:unicode_e.end])})"
        )
    except Exception as e:
        print(f"❌ 에러 발생: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"서버 내부 오류: {str(e)}"
        )

# 사용시간 업데이트 엔드포인트
@chrome_router.post("/update_duration")
async def update_duration(data: DurationUpdateData):
    """
    크롬 익스텐션에서 보낸 사용시간 정보를 받아서 기존 로그를 업데이트
    """
    try:
        # 받은 데이터 로그 출력
        print(f"⏰ 사용시간 업데이트 요청:")
        print(f"  - URL: {data.url}")
        print(f"  - 도메인: {data.domain}")
        print(f"  - 체류 시간: {data.duration}초")
        print(f"  - 방문 시작: {datetime.fromtimestamp(data.visitStartTime/1000).strftime('%H:%M:%S')}")
        print(f"  - 방문 종료: {datetime.fromtimestamp(data.visitEndTime/1000).strftime('%H:%M:%S')}")

        # URL과 도메인으로 해당 로그 찾기
        # 이 쿼리도 특수 문자에 의해 영향을 받을 수 있으므로, 쿼리 문자열도 클리닝을 고려할 수 있습니다.
        # 하지만 Supabase의 eq() 메소드가 내부적으로 인코딩을 잘 처리할 가능성이 높습니다.
        response = supabase.table('chrome_logs').select('*').eq('url', clean_text(data.url)).eq('domain', clean_text(data.domain)).order('created_at', desc=True).limit(1).execute()

        if response.data:
            chrome_log = response.data[0]

            # duration 업데이트
            update_response = supabase.table('chrome_logs').update({
                "duration": data.duration
            }).eq('id', chrome_log['id']).execute()

            if update_response.data:
                updated_log = update_response.data[0]
                print(f"✅ 사용시간 업데이트 성공: ID {updated_log['id']}, 체류시간 {data.duration}초")

                # 성공 응답
                return {
                    "success": True,
                    "message": f"사용시간이 성공적으로 업데이트되었습니다. (체류시간: {data.duration}초)",
                    "data": {
                        "id": updated_log["id"],
                        "url": data.url,
                        "domain": data.domain,
                        "duration": data.duration,
                        "updated_at": datetime.now().isoformat()
                    }
                }
            else:
                raise Exception("Supabase 업데이트 실패: 응답 데이터 없음")
        else:
            print(f"⚠️ 해당 로그를 찾을 수 없음: {data.url}")
            return {
                "success": False,
                "message": "해당 로그를 찾을 수 없습니다.",
                "data": None
            }

    except UnicodeEncodeError as unicode_e:
        # UnicodeEncodeError를 명시적으로 잡아서 더 자세한 정보 출력
        print(f"❌ UnicodeEncodeError 발생:")
        print(f"  - 인코딩: {unicode_e.encoding}")
        print(f"  - 원인: {unicode_e.reason}")
        print(f"  - 실패한 객체: {repr(unicode_e.object)}")
        print(f"  - 위치: {unicode_e.start}-{unicode_e.end}")
        raise HTTPException(
            status_code=500,
            detail=f"서버 내부 오류: 인코딩 문제 발생 - {unicode_e.reason} (문자열: {repr(unicode_e.object[unicode_e.start:unicode_e.end])})"
        )
    except Exception as e:
        print(f"❌ 에러 발생: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"서버 내부 오류: {str(e)}"
        )

# 로그 조회 엔드포인트
@chrome_router.get("/logs")
async def get_logs(limit: int = 10, user_id: Optional[str] = None):
    """
    저장된 크롬 로그를 조회합니다.
    user_id가 제공되면 해당 사용자의 로그만 조회합니다.
    """
    try:
        query = supabase.table('chrome_logs').select('*')
        
        # user_id가 제공되면 해당 사용자의 로그만 필터링
        if user_id:
            query = query.eq('user_id', user_id)
        
        response = query.order('created_at', desc=True).limit(limit).execute()

        if response.data:
            return {
                "success": True,
                "data": response.data,
                "count": len(response.data)
            }
        return {
            "success": True,
            "data": [],
            "count": 0
        }
    except UnicodeEncodeError as unicode_e:
        # UnicodeEncodeError를 명시적으로 잡아서 더 자세한 정보 출력
        print(f"❌ UnicodeEncodeError 발생:")
        print(f"  - 인코딩: {unicode_e.encoding}")
        print(f"  - 원인: {unicode_e.reason}")
        print(f"  - 실패한 객체: {repr(unicode_e.object)}")
        print(f"  - 위치: {unicode_e.start}-{unicode_e.end}")
        raise HTTPException(
            status_code=500,
            detail=f"로그 조회 실패: 인코딩 문제 발생 - {unicode_e.reason} (문자열: {repr(unicode_e.object[unicode_e.start:unicode_e.end])})"
        )
    except Exception as e:
        print(f"❌ 로그 조회 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"로그 조회 실패: {str(e)}"
        )
