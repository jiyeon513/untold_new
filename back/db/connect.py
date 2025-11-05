# back/db/connect.py
# 데이터베이스 연결 설정

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

# Supabase 클라이언트 생성
supabase: Client = create_client(url, key)