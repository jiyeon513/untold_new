import httpx
import os

API_URL = "https://api.openweathermap.org/data/2.5/weather"

async def get_weather_data(city: str = "Daejeon"):
    """특정 도시의 날씨 정보를 가져옵니다."""
    WEATHER_MAP_KEY = os.getenv("WEATHER_MAP_KEY")
    if not WEATHER_MAP_KEY:
        return {"error": "날씨 정보를 가져오는 데 실패했습니다. API 키가 설정되지 않았습니다."}
    
    params = {
        "q": city,
        "appid": WEATHER_MAP_KEY,
        "units": "metric",
        "lang": "kr"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(API_URL, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"날씨 정보를 가져오는 데 실패했습니다: {str(e)}"}