import httpx

# 이 API는 별도의 키가 필요 없습니다.
DOG_API_URL = "https://random.dog/woof.json"

async def get_random_dog_image():
    """임의의 강아지 이미지 정보를 가져오는 함수"""
    async with httpx.AsyncClient() as client:
        try:
            # 외부 API에 GET 요청을 보냅니다.
            response = await client.get(DOG_API_URL)
            
            # HTTP 상태 코드가 200 (성공)이 아니면 에러를 발생시킵니다.
            response.raise_for_status() 
            
            data = response.json()
            # 이미지 파일만 반환하도록 필터링 (gif, mp4 등 제외)
            if data['url'].endswith(('.jpg', '.jpeg', '.png')):
                return data
            else:
                # 이미지가 아니면 재시도 (간단한 재귀 호출)
                return await get_random_dog_image()

        except httpx.HTTPStatusError as e:
            return {"error": f"API 요청 실패: {e.response.status_code}"}
        except Exception as e:
            return {"error": f"알 수 없는 오류 발생: {str(e)}"}