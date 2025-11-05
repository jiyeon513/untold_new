from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import os
from typing import Optional
import asyncio
from db.connect import supabase

router = APIRouter()

model = None
tokenizer = None
is_model_loaded = False

class DiaryGenerationRequest(BaseModel):
    original_text: str
    user_id: str
    diary_id: str

class DiaryGenerationResponse(BaseModel):
    generated_text: str
    original_length: int
    generated_length: int
    model_version: str

async def load_lora_model():
    global model, tokenizer, is_model_loaded
    if is_model_loaded and model is not None and tokenizer is not None:
        print("🤖 LoRA 모델이 이미 로드되어 있습니다.")
        return

    try:
        print("🤖 LoRA 모델 로딩 시작...")
        base_model_name = "EleutherAI/polyglot-ko-1.3b"
        lora_model_path = os.path.join(os.path.dirname(__file__), "..", "..", "lora", "models")

        tokenizer = AutoTokenizer.from_pretrained(base_model_name)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        tokenizer.padding_side = "left"

        compute_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            torch_dtype=compute_dtype,
            device_map="auto" if torch.cuda.is_available() else None
        )
        print("✅ 베이스 모델 로드 완료.")

        try:
            model = PeftModel.from_pretrained(base_model, lora_model_path)
            print("✅ LoRA 모델 로드 성공!")
        except Exception as e:
            print(f"❌ LoRA 가중치 로딩 실패: {e}")
            model = base_model
            is_model_loaded = False
            return

        model.eval()
        is_model_loaded = True
        print("✅ LoRA 모델 준비 완료!")

    except Exception as e:
        print(f"❌ 모델 전체 로딩 실패: {e}")
        model = None
        tokenizer = None
        is_model_loaded = False

@router.post("/lora/generate", response_model=DiaryGenerationResponse)
async def generate_diary_with_lora(request: DiaryGenerationRequest):
    try:
        print(f"🤖 텍스트 생성 요청: user={request.user_id}, length={len(request.original_text)}")
        if not is_model_loaded or model is None or tokenizer is None:
            await load_lora_model()
            if not is_model_loaded:
                fallback_text = request.original_text + "\n오늘 하루도 행복한 하루였다."
                return DiaryGenerationResponse(
                    generated_text=fallback_text,
                    original_length=len(request.original_text),
                    generated_length=len(fallback_text),
                    model_version="fallback_model_not_loaded"
                )

        generated_text = await generate_personalized_text(request.original_text)
        print(f"✅ 생성 완료: {generated_text}")
        return DiaryGenerationResponse(
            generated_text=generated_text,
            original_length=len(request.original_text),
            generated_length=len(generated_text),
            model_version="lora-v1.0"
        )

    except Exception as e:
        print(f"❌ 텍스트 생성 오류: {e}")
        fallback_text = request.original_text + "\n오늘 하루도 행복한 하루였다."
        return DiaryGenerationResponse(
            generated_text=fallback_text,
            original_length=len(request.original_text),
            generated_length=len(fallback_text),
            model_version="fallback_exception"
        )

async def generate_personalized_text(original_text: str) -> str:
    try:
        if model is None or tokenizer is None:
            return original_text + "\n행복한 하루였다."

        prompt = f"""다음은 일기를 감성적인 문체로 개선하는 예시야:

입력: 오늘 기분이 좋았다.
출력: 햇살이 비추는 아침, 마음까지 따뜻해지는 하루의 시작이었다.

입력: {original_text}
출력:"""

        inputs = tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True
        )
        inputs = {k: v.to(model.device) for k, v in inputs.items()}

        with torch.no_grad():
            generated_ids = model.generate(
                inputs["input_ids"],
                attention_mask=inputs["attention_mask"],
                do_sample=True,
                top_k=50,
                top_p=0.95,
                temperature=0.8,
                max_new_tokens=200,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
                no_repeat_ngram_size=3,
                repetition_penalty=1.15,
                length_penalty=1.2,
                early_stopping=True
            )

        generated_text = tokenizer.decode(generated_ids[0], skip_special_tokens=True)

        # 출력 파싱
        idx = generated_text.rfind("출력:")
        if idx != -1:
            generated_text = generated_text[idx + len("출력:"):].strip()
        else:
            if original_text in generated_text:
                generated_text = generated_text.split(original_text)[-1].strip()

        # 긍정 문장 하드코딩
        generated_text = post_process_text(generated_text, original_text)
        return generated_text + "\n행복한 하루였다."

    except Exception as e:
        print(f"❌ 추론 실패: {e}")
        return original_text + "\n행복한 하루였다."

def post_process_text(generated_text: str, original_text: str) -> str:
    try:
        text = generated_text.strip()

        lines = text.split('\n')
        cleaned_lines = []
        seen = set()
        for line in lines:
            line = line.strip()
            if line and line not in seen:
                cleaned_lines.append(line)
                seen.add(line)
        text = '\n'.join(cleaned_lines)


        if len(text) < 10:  # 최소 10자 이상이면 사용
            print(f"⚠️ 생성된 텍스트가 너무 짧습니다: {len(text)}자. 원본 반환.")
            return original_text

        return text
    except Exception as e:
        print(f"❌ 후처리 실패: {e}")
        return generated_text

@router.on_event("startup")
async def startup_event():
    print("🚀 서버 시작: 모델 로드 시도")
    try:
        await load_lora_model()
    except Exception as e:
        print(f"⚠️ 서버 시작 시 모델 로딩 실패: {e}")
