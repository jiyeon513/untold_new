# back/ml/train_emotion_regressor.py
import torch
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModel, TrainingArguments, Trainer
from sklearn.metrics import mean_absolute_error, mean_squared_error
import numpy as np

# 1. 모델과 토크나이저 로드
MODEL_NAME = "intfloat/multilingual-e5-large-instruct"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
base_model = AutoModel.from_pretrained(MODEL_NAME)

# 2. 러셀 모델을 위한 커스텀 모델 정의 (Regression Head)
class EmotionRegressor(torch.nn.Module):
    def __init__(self, base_model):
        super().__init__()
        self.encoder = base_model
        self.regressor = torch.nn.Sequential(
            torch.nn.Linear(1024, 2), # 출력: [valence, arousal] 2개
            torch.nn.Tanh()      # 결과를 -1 ~ 1 사이로 제한
        )
    def forward(self, input_ids, attention_mask, labels=None):
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        cls_vector = outputs.last_hidden_state[:, 0]
        logits = self.regressor(cls_vector)
        loss = None
        if labels is not None:
            # 회귀 문제이므로 MSELoss 사용
            loss_fct = torch.nn.MSELoss()
            loss = loss_fct(logits, labels)
        return (loss, logits) if loss is not None else logits

# 3. 데이터셋 로드 및 전처리
def preprocess_function(examples):
    inputs = [f"query: {text}" for text in examples["text"]]
    tokenized_inputs = tokenizer(inputs, max_length=128, truncation=True, padding="max_length")
    tokenized_inputs["labels"] = [[v, a] for v, a in zip(examples["valence"], examples["arousal"])]
    return tokenized_inputs

dataset = load_dataset("csv", data_files={"train": "back/ml/kote_regression_train.csv", "validation": "back/ml/kote_regression_validation.csv"})
tokenized_dataset = dataset.map(preprocess_function, batched=True, remove_columns=["text", "valence", "arousal"])

# 4. 평가 지표 정의 (회귀용)
def compute_metrics(eval_pred):
    predictions, labels = eval_pred
    mae = mean_absolute_error(labels, predictions)
    mse = mean_squared_error(labels, predictions)
    return {"mae": mae, "mse": mse}

# 5. 학습 설정
training_args = TrainingArguments(
    output_dir="back/ml/emotion_regressor_model",
    num_train_epochs=3,
    per_device_train_batch_size=16,
    learning_rate=2e-5,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
)

# 6. Trainer 설정 및 학습 시작
model = EmotionRegressor(base_model)
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset["train"],
    eval_dataset=tokenized_dataset["validation"],
    compute_metrics=compute_metrics,
    tokenizer=tokenizer,
)

print("KOTE 데이터셋으로 2D 감정 회귀 모델 Fine-tuning을 시작합니다...")
trainer.train()
print("학습이 완료되었습니다.")

trainer.save_model("back/ml/best_emotion_regressor")
print("최종 모델이 back/ml/best_emotion_regressor 폴더에 저장되었습니다.")