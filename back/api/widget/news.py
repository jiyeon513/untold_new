import httpx
import os

API_URL = "https://newsapi.org/v2/top-headlines"

async def get_news_data():
    """뉴스 정보를 가져옵니다."""
    NEWS_API_KEY = os.getenv("NEWS_API_KEY")
    if not NEWS_API_KEY:
        return {"error": "뉴스 정보를 가져오는 데 실패했습니다. API 키가 설정되지 않았습니다."}
    
    params = {
        "country": "us",
        "apiKey": NEWS_API_KEY,
        "pageSize": 5
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(API_URL, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"뉴스 정보를 가져오는 데 실패했습니다: {str(e)}"}