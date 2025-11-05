import httpx
import os
import json

API_URL = "http://www.aladin.co.kr/ttb/api/ItemList.aspx"

async def get_new_book_list():
    """알라딘 신간 추천 리스트 목록을 가져옵니다."""
    TTB_KEY = os.getenv("ALADIN_TTB_KEY")
    print(f"DEBUG: TTB_KEY = {TTB_KEY}")  # 디버깅용 출력
    if not TTB_KEY:
        return {"error": "알라딘 TTBKey가 설정되지 않았습니다."}

    # API 요청에 필요한 파라미터 설정
    params = {
        "ttbkey": TTB_KEY,
        "QueryType": "ItemNewSpecial", # 주목할 만한 신간 리스트
        "MaxResults": 6,          # 6권만 가져오기
        "start": 1,
        "SearchTarget": "Book",
        "output": "js",           # JSON 형식으로 받기
        "Version": "20131101"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(API_URL, params=params)
            # 알라딘 API는 에러가 발생해도 상태코드 200을 줄 수 있으므로, 내용으로 확인합니다.
            data = response.json()
            if "errorCode" in data:
                # 에러 코드가 있다면, 에러 메시지를 포함하여 반환합니다.
                return {
                    "error": "알라딘 API가 에러를 반환했습니다.",
                    "details": data.get("errorMessage", "알 수 없는 에러")
                }
            return data
        except json.JSONDecodeError:
            return {
                "error": "알라딘 API 응답을 파싱할 수 없습니다.",
                "details": "응답이 JSON 형식이 아닙니다. TTBKey가 유효한지 확인하세요."
            }
        except httpx.HTTPStatusError as e:
            return {
                "error": f"HTTP 에러 발생: {e.response.status_code}",
                "details": e.response.text
            }
        except Exception as e:
            return {"error": f"알 수 없는 오류 발생: {str(e)}"}