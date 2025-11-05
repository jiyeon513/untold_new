import httpx

# API 주소를 새로운 한국어 명언 API로 변경합니다.
API_URL = "https://korean-advice-open-api.vercel.app/api/advice"

async def get_random_advice():
    """임의의 한국어 명언 정보를 가져옵니다."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(API_URL)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"명언을 가져오는 데 실패했습니다: {str(e)}"}