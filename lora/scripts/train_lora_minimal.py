# scripts/train_lora_minimal.py
# CPU 환경에서 적은 데이터로 LoRA 학습
from peft import LoraConfig, get_peft_model
from transformers import AutoTokenizer, AutoModelForCausalLM, Trainer, TrainingArguments, DataCollatorForSeq2Seq
from datasets import load_dataset
import torch
import os

print("🚀 LoRA 최소 학습 시작 (CPU 환경)")

# 모델 및 토크나이저 불러오기
model_name = "EleutherAI/polyglot-ko-1.3b"
tokenizer = AutoTokenizer.from_pretrained(model_name)

# 패딩 토큰 설정
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right" 

print("📥 모델 로딩 중...")
# CPU 환경에 맞는 설정
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float32,  # CPU에서는 float32
    device_map=None  # CPU 사용
)

# LoRA 설정 (최소 설정)
lora_config = LoraConfig(
    r=4,  # 랭크를 더 작게 설정
    lora_alpha=16,  # 알파값도 줄임
    target_modules=["q_proj", "v_proj"],  # 더 적은 모듈만 학습
    lora_dropout=0.1,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)
print("✅ LoRA 모델 설정 완료")

# 학습 가능한 파라미터 수 출력
print("\n--- 학습 가능한 파라미터 수 ---")
model.print_trainable_parameters()
print("---------------------------\n")

# 데이터셋 불러오기
print("📊 데이터셋 로딩 중...")
dataset = load_dataset("json", data_files="../data/user_diaries.jsonl")["train"]
print(f"📈 총 {len(dataset)}개 데이터 로드됨")

# 데이터 전처리 함수
def preprocess_function(examples):
    tokenized_input = tokenizer(
        examples["text"],
        max_length=512,  # 더 짧게 설정
        truncation=True,
        padding="max_length" 
    )
    tokenized_input["labels"] = tokenized_input["input_ids"].copy() 
    return tokenized_input

tokenized_dataset = dataset.map(preprocess_function, batched=True, remove_columns=["text"])
print("✅ 데이터 전처리 완료")

# 최소 학습 인자 설정
training_args = TrainingArguments(
    output_dir="./models/lora_minimal",
    per_device_train_batch_size=1,  # 배치 크기 1
    gradient_accumulation_steps=4,  # 그래디언트 누적
    num_train_epochs=1,  # 1 에포크만
    learning_rate=1e-4,  # 낮은 학습률
    logging_steps=5,  # 더 자주 로깅
    save_steps=25,  # 더 자주 저장
    save_total_limit=1,
    fp16=False,  # CPU에서는 fp16 비활성화
    remove_unused_columns=False,
    warmup_steps=10,  # 워밍업 추가
)

print("🎯 학습 시작...")
# Trainer 초기화 및 학습 시작
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
    tokenizer=tokenizer,
    data_collator=DataCollatorForSeq2Seq(tokenizer, model=model, padding="longest", label_pad_token_id=tokenizer.pad_token_id),
)

trainer.train()

print("\n🎉 LoRA 최소 학습 완료!")
print("📁 모델이 ./models/lora_minimal 에 저장되었습니다.")
print("💡 이제 generate_diary.py에서 이 모델을 사용할 수 있습니다.") 