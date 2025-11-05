# scripts/train_lora.py
from peft import LoraConfig, get_peft_model
from transformers import AutoTokenizer, AutoModelForCausalLM, Trainer, TrainingArguments, DataCollatorForSeq2Seq
from datasets import load_dataset
import torch

# 모델 및 토크나이저 불러오기
model_name = "EleutherAI/polyglot-ko-1.3b" # 이 부분은 이미 수정하셨을 겁니다.
tokenizer = AutoTokenizer.from_pretrained(model_name)

# 패딩 토큰 설정 (필요시)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right" 

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16, 
    load_in_4bit=True # 4비트 양자화로 메모리 절약
)

# LoRA 설정 정의
lora_config = LoraConfig(
    r=8, # LoRA 랭크(숫자가 작을수록 메모리 효율적, 표현력 떨어짐)
    lora_alpha=32, # loRA 가중치를 얼마나 크게 적용할지지
    # --- 이 부분이 변경되어야 합니다! ---
    target_modules=["query_key_value", "dense"], # Polyglot-ko 모델에 맞는 모듈 이름으로 변경
    # --- 여기까지 변경 ---
    lora_dropout=0.05, #과적합 방지 정도
    bias="none",
    task_type="CAUSAL_LM"
)
model = get_peft_model(model, lora_config) # LoRA 모델로 변환

# 학습 가능한 파라미터 수 출력
print("\n--- 학습 가능한 파라미터 수 ---")
model.print_trainable_parameters()
print("---------------------------\n")

# 데이터셋 불러오기
dataset = load_dataset("json", data_files="data/user_diaries.jsonl")["train"]

# 데이터 전처리 함수: 텍스트를 토큰화하고 레이블 설정
def preprocess_function(examples):
    tokenized_input = tokenizer(
        examples["text"],
        max_length=2048, 
        truncation=True,
        padding="max_length" 
    )
    tokenized_input["labels"] = tokenized_input["input_ids"].copy() 
    return tokenized_input

tokenized_dataset = dataset.map(preprocess_function, batched=True, remove_columns=["text"]) # 데이터셋 전처리

# 학습 인자 설정
training_args = TrainingArguments(
    output_dir="./models/lora",
    per_device_train_batch_size=2,
    gradient_accumulation_steps=4,
    num_train_epochs=5, #반복 학습 수
    learning_rate=2e-4, #학습률
    logging_steps=10, #로깅 간격
    save_steps=50, #저장 간격
    save_total_limit=1, #저장 최대 개수
    fp16=True, # 혼합 정밀도 학습 활성화
)

# Trainer 초기화 및 학습 시작
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
    tokenizer=tokenizer,
    data_collator=DataCollatorForSeq2Seq(tokenizer, model=model, padding="longest", label_pad_token_id=tokenizer.pad_token_id),
)

trainer.train() # 학습 실행

print("\n--- 학습 완료! LoRA 모델이 ./models/lora 에 저장되었습니다. ---\n")