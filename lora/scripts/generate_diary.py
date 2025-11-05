# scripts/generate_diary.py
from transformers import AutoTokenizer, AutoModelForCausalLM, GenerationConfig
from peft import PeftModel
import torch
import os

# 모델 로딩 경로 설정
BASE_MODEL_NAME = "EleutherAI/polyglot-ko-1.3b"
# 이 LORA_MODEL_DIR은 Polyglot-ko 학습 후 새로 생성된 체크포인트 경로로 변경해야 합니다.
# 예: LORA_MODEL_DIR = "/root/lora/models/lora/checkpoint-새로운숫자"
LORA_MODEL_DIR = "/root/lora/models/lora/checkpoint-5" # 학습 후 실제 경로로 변경 필요!

print(f"--- 모델 로딩 시작: {BASE_MODEL_NAME} ---")

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
# Polyglot-ko의 경우 EOS 토큰이 이미 잘 설정되어 있을 수 있습니다.
# 확실하게 설정하되, 모델의 기본 설정을 존중합니다.
if tokenizer.eos_token_id is None: # eos_token_id가 없다면 pad_token을 eos로 설정
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.pad_token_id = tokenizer.eos_token_id # pad_token_id도 명시적으로 설정
elif tokenizer.pad_token is None: # eos_token_id는 있는데 pad_token이 없다면 pad_token을 eos로
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.pad_token_id = tokenizer.eos_token_id

tokenizer.padding_side = "right"

base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL_NAME,
    torch_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
    load_in_4bit=True,
    device_map="auto"
)

# LoRA 가중치 로드 및 병합
model = PeftModel.from_pretrained(base_model, LORA_MODEL_DIR, is_local_path=True)
print("--- LoRA 가중치 병합 중 ---")
model = model.merge_and_unload()
print("--- LoRA 가중치 병합 완료! ---")
model.eval()

print(f"--- 모델 로딩 및 병합 완료! ({LORA_MODEL_DIR} 적용) ---\n")

# 사용자별 스타일 정보
USER_STYLES = {
    "user_A": "감성적이고 서정적인 스타일",
    "user_B": "간결하고 실용적인 스타일", 
    "user_C": "유머러스하고 친근한 스타일",
    "user_D": "철학적이고 깊이 있는 스타일"
}

# 텍스트 생성 함수
def generate_diary_text(user_id: str, diary_input: str, max_new_tokens: int = 150):
    """
    사용자별 말투로 일기를 생성하는 함수
    
    Args:
        user_id: 사용자 ID (user_A, user_B, user_C, user_D)
        diary_input: 사용자가 입력한 일기 텍스트
        max_new_tokens: 생성할 최대 토큰 수
    """
    style = USER_STYLES.get(user_id, "일반적인 스타일")
    
    # 프롬프트 생성 - 사용자별 말투로 일기 작성
    prompt = f"다음 일기를 {user_id}의 말투로 다시 작성해줘. {style}로 5-10줄의 일기를 작성해줘.\n\n입력 일기: {diary_input}\n\n{user_id}의 말투로 작성:"

    # 토큰화 시 attention_mask 명시적 설정
    inputs = tokenizer(
        prompt, 
        return_tensors="pt", 
        truncation=True, 
        max_length=512,  # 더 긴 프롬프트를 위해 증가
        padding=True,
        return_attention_mask=True
    )
    
    input_ids = inputs.input_ids.to(model.device)
    attention_mask = inputs.attention_mask.to(model.device)

    # 생성 파라미터 조정 - 더 자연스러운 일기 생성을 위해
    generated_ids = model.generate(
        input_ids,
        attention_mask=attention_mask,
        do_sample=True,
        top_k=50,        # 더 다양한 선택을 위해 증가
        top_p=0.9,       # 더 자연스러운 생성을 위해 증가
        temperature=0.7, # 적당한 창의성
        max_new_tokens=max_new_tokens,
        pad_token_id=tokenizer.pad_token_id,
        eos_token_id=tokenizer.eos_token_id,
        no_repeat_ngram_size=3,  # 반복 방지
        repetition_penalty=1.1   # 반복 패널티
    )

    generated_text = tokenizer.decode(generated_ids[0], skip_special_tokens=True)
    
    # 프롬프트 부분 잘라내기
    if f"{user_id}의 말투로 작성:" in generated_text:
        generated_text = generated_text.split(f"{user_id}의 말투로 작성:")[1].strip()
    
    # 특수 토큰들 제거
    special_tokens = ["</s>", "<s>", "[INST]", "[/INST]", "[INGLMENTS]", "[/INGLMENTS]", "[INMESSAYS]", "[/INMESSAYS]", "[IMNSTATER]", "[/IMNSTATER]", "[IMNST", "[/IMNST"]
    for token in special_tokens:
        generated_text = generated_text.replace(token, "")
    
    # 5-10줄로 조정
    lines = generated_text.split('.')
    lines = [line.strip() for line in lines if line.strip()]
    
    if len(lines) > 10:
        lines = lines[:10]
    elif len(lines) < 5:
        # 짧으면 문장을 더 추가
        additional_sentences = [
            "하루를 마무리하며 감사한 마음을 가졌다.",
            "내일도 좋은 하루가 되길 바란다.",
            "이런 순간들이 소중하다고 생각한다.",
            "시간이 흘러도 이 기억은 남을 것 같다."
        ]
        lines.extend(additional_sentences[:5-len(lines)])
    
    # 줄글 형태로 재구성
    formatted_diary = '. '.join(lines) + '.'
    
    return formatted_diary.strip()

# 사용자 입력 및 생성 실행
if __name__ == "__main__":
    print("--- 사용자별 말투 일기 생성기 ---")
    print("종료하려면 'exit'을 입력하세요.")
    print("\n사용 가능한 사용자:")
    for user_id, style in USER_STYLES.items():
        print(f"- {user_id}: {style}")

    while True:
        print("\n" + "="*50)
        user_id = input("사용자 ID를 입력하세요 (user_A, user_B, user_C, user_D): ").strip()
        if user_id.lower() == 'exit':
            break

        if user_id not in USER_STYLES:
            print(f"잘못된 사용자 ID입니다. 다음 중에서 선택해주세요: {', '.join(USER_STYLES.keys())}")
            continue

        diary_input = input("일기 내용을 입력하세요 (카테고리 없이 줄글): ").strip()
        if diary_input.lower() == 'exit':
            break

        if not diary_input:
            print("일기 내용을 입력해야 합니다. 다시 시도해주세요.")
            continue

        print(f"\n--- {user_id}의 말투로 일기 생성 중... 잠시 기다려주세요 ---")
        try:
            generated_diary = generate_diary_text(user_id, diary_input, max_new_tokens=150)
            print(f"\n--- {user_id}의 말투로 생성된 일기 ---")
            print(f"스타일: {USER_STYLES[user_id]}")
            print("-" * 40)
            print(generated_diary)
            print("-" * 40)
        except Exception as e:
            print(f"텍스트 생성 중 오류 발생: {e}")
            print("GPU 메모리가 부족할 수 있습니다. max_new_tokens를 줄여보세요.")

    print("생성기를 종료합니다.")