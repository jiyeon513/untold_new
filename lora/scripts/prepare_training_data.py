# DB 연결하기 전의 테스트 코드입니다.

# scripts/prepare_training_data.py
import json
import os
from datetime import datetime, timedelta
import random # 더미 데이터 생성에 필요

# 학습 데이터를 저장할 파일 경로
OUTPUT_FILE_PATH = "data/user_diaries.jsonl"

# --- 더미 데이터 불러오기 함수 ---
def get_user_cards_from_dummy_data():
    """
    DB 대신 학습에 필요한 더미 카드 데이터를 반환하는 함수입니다.
    카테고리와 text_final, content 필드를 포함합니다.
    """
    dummy_data = [
        # 일기 카테고리 (내 말투)
        {"category": "일기", "text_final": "오늘은 날씨가 좋아서 기분이 좋았다. 햇살도 따뜻하고 산책하기 딱 좋았다.", "content": "기분 좋았던 날의 산책"},
        {"category": "일기", "text_final": "아침에 일찍 일어나 커피 한 잔을 마시며 하루를 시작했다. 조용한 시간이 참 좋다. 여유롭게 명상도 했다.", "content": "여유로운 아침"},
        {"category": "일기", "text_final": "비가 내리는 날엔 어쩐지 마음도 촉촉해지는 느낌이다. 창밖을 보며 생각에 잠겼다. 따뜻한 차 한 잔과 함께.", "content": "비오는 날의 감상"},
        {"category": "일기", "text_final": "오랜만에 친구랑 놀아서 너무 즐거웠다. 다음에 또 만나자고 약속했다! 시간이 쏜살같았다.", "content": "친구와의 즐거운 시간"},
        {"category": "일기", "text_final": "요즘 잠이 잘 안 와서 피곤하다. 내일은 꼭 일찍 자야지. 피로가 쌓이는 느낌이다.", "content": "수면 부족의 피로"},
        {"category": "일기", "text_final": "새로운 취미를 시작했다. 아직 서툴지만 배우는 과정이 흥미롭다. 앞으로가 기대된다.", "content": "새로운 취미 시작"},
        {"category": "일기", "text_final": "생각지도 못한 행운이 찾아왔다. 작은 일이지만 하루 종일 미소가 떠나지 않았다. 감사한 하루.", "content": "뜻밖의 행운"},

        # 뉴스 요약 카테고리 (내 말투)
        {"category": "뉴스_요약", "text_final": "최근 AI 기술 발전이 산업 전반에 긍정적 영향을 미치고 있다고 한다. 특히 제조업 분야에서 자동화율이 크게 늘었다고 함.", "content": "AI 기술의 산업 영향"},
        {"category": "뉴스_요약", "text_final": "새로운 환경 규제가 발표되며 친환경 에너지 기업들의 주가가 상승했다. 정부는 2030년까지 탄소 배출량 30% 감축을 목표로 하는 듯.", "content": "환경 규제와 에너지 주가"},
        {"category": "뉴스_요약", "text_final": "글로벌 경제 성장률이 예상치를 상회하며 회복세를 보이고 있다. 인플레이션 우려도 점차 완화되는 분위기다.", "content": "글로벌 경제 회복"},
        {"category": "뉴스_요약", "text_final": "이번 주말, 서울 도심에서 대규모 문화 축제가 열릴 예정. 다양한 공연과 체험 프로그램이 준비되었다고 함.", "content": "서울 문화 축제"},

        # 명언 카테고리 (내 말투)
        {"category": "명언", "text_final": "성공은 가장 큰 복수다. - 프랭크 시나트라", "content": "성공 명언"},
        {"category": "명언", "text_final": "인생은 용감한 모험이거나 아무것도 아니다. - 헬렌 켈러", "content": "인생 명언"},
        {"category": "명언", "text_final": "가장 큰 위험은 위험을 감수하지 않는 것이다. - 마크 주커버그", "content": "위험과 도전 명언"},

        # 감정_기록 카테고리 (내 말투)
        {"category": "감정_기록", "text_final": "오늘은 정말 화가 났지만, 잘 참아냈다. 내일은 더 좋은 일이 있길 바란다. 스스로를 다독였다.", "content": "화난 감정 다스리기"},
        {"category": "감정_기록", "text_final": "왠지 모르게 불안하고 답답한 하루였다. 특별한 일은 없었는데 마음이 편치 않았다. 스스로를 위로했다.", "content": "불안한 하루"},
        {"category": "감정_기록", "text_final": "아무것도 하기 싫고 무기력한 날이다. 그냥 이대로 쉬고 싶다. 내일은 괜찮아지겠지.", "content": "무기력한 감정"},
    ]
    

    return dummy_data

# --- 프롬프트 형식 변환 함수 (이전과 동일) ---
def format_data_for_lora(cards_data):
    formatted_entries = []
    for item in cards_data:
        category = item.get('category')
        final_text = item.get('text_final')
        content = item.get('content') 

        if not category or not final_text:
            print(f"경고: 카테고리 또는 최종 텍스트가 없는 항목을 건너뜀: {item}")
            continue
        
        # content 필드를 최대한 활용하고, 없으면 final_text의 앞부분을 힌트로 사용
        content_for_prompt = content if content else (final_text[:min(50, len(final_text))] + "..." if len(final_text) > 50 else final_text)

        instruction = f"카테고리가 {category}인 글을 내 말투로 작성해줘. 내용은 '{content_for_prompt}'야."
        response = final_text

        full_text_entry = f"<s>[INST] {instruction} [/INST]\n{response}</s>"
        formatted_entries.append({"text": full_text_entry})
    
    return formatted_entries

# --- 메인 실행 로직 ---
def prepare_training_data():
    """
    더미 데이터를 불러와 전처리하고 파일로 저장하는 전체 프로세스를 실행합니다.
    """
    print(f"--- 학습 데이터 준비 시작 (더미 데이터 사용) ---")

    try:
        cards_data = get_user_cards_from_dummy_data()

        if not cards_data:
            print("학습할 더미 카드 데이터가 없습니다. 스크립트를 종료합니다.")
            return

        formatted_entries = format_data_for_lora(cards_data)

        # data 폴더가 없으면 생성
        os.makedirs(os.path.dirname(OUTPUT_FILE_PATH), exist_ok=True)

        with open(OUTPUT_FILE_PATH, "w", encoding="utf-8") as f:
            for entry in formatted_entries:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        
        print(f"총 {len(formatted_entries)}개의 학습 데이터가 '{OUTPUT_FILE_PATH}'에 성공적으로 저장되었습니다.")

    except Exception as e:
        print(f"학습 데이터 준비 중 오류 발생: {e}")

if __name__ == "__main__":
    prepare_training_data()