# back/ml/emotion_classifier.py
import torch
import os
from transformers import AutoTokenizer, AutoModel
import numpy as np
from huggingface_hub import hf_hub_download

# EmotionRegressor 클래스 정의 (훈련 시 사용했던 것과 동일)
class EmotionRegressor(torch.nn.Module):
    def __init__(self, base_model):
        super().__init__()
        self.encoder = base_model
        # 모델의 hidden size를 동적으로 가져옴
        hidden_size = base_model.config.hidden_size
        self.regressor = torch.nn.Sequential(
            torch.nn.Linear(hidden_size, 2), # 출력: [valence, arousal] 2개
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

def download_model_from_hub():
    """Hugging Face Hub에서 모델 다운로드"""
    print("🤗 Hugging Face Hub에서 모델 다운로드 중...")
    
    REPO_ID = "kjy8402/untold-2d-emotion-model"
    files_to_download = [
        "model.safetensors",
        "tokenizer.json", 
        "tokenizer_config.json",
        "special_tokens_map.json",
        "training_args.bin"
    ]
    
    # 다운로드 디렉토리 생성
    download_dir = "ml/best_emotion_regressor"
    os.makedirs(download_dir, exist_ok=True)
    
    try:
        for filename in files_to_download:
            print(f"📥 다운로드 중: {filename}")
            downloaded_path = hf_hub_download(
                repo_id=REPO_ID,
                filename=filename,
                local_dir=download_dir,
                local_dir_use_symlinks=False
            )
            print(f"✅ 완료: {filename}")
        
        print("🎉 모델 다운로드 완료!")
        return True
        
    except Exception as e:
        print(f"❌ 다운로드 실패: {e}")
        return False

# 모델과 토크나이저 로드 (한 번만 실행)
print("2D 감정 분석 모델을 로드하는 중...")

# 베이스 모델 로드
MODEL_NAME = "intfloat/multilingual-e5-large-instruct"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
base_model = AutoModel.from_pretrained(MODEL_NAME, trust_remote_code=True)

# 훈련된 감정 회귀 모델 로드
model = EmotionRegressor(base_model)

# 모델 경로 확인 및 다운로드
model_paths = [
    "/root/UnTold/back/ml/best_emotion_regressor",  # GPU 서버 경로
    "ml/best_emotion_regressor",                   # 상대 경로
    "./best_emotion_regressor"                          # 현재 디렉토리
]

model_loaded = False
model_path = None

# 기존 모델 경로들 시도
for path in model_paths:
    if os.path.exists(os.path.join(path, "model.safetensors")):
        model_path = path
        print(f"✅ 로컬 모델 발견: {model_path}")
        break

# 로컬에 모델이 없으면 Hugging Face에서 다운로드
if not model_path:
    print("⚠️  로컬에 모델이 없습니다.")
    if download_model_from_hub():
        model_path = "ml/best_emotion_regressor"
    else:
        raise FileNotFoundError("모델을 다운로드할 수 없습니다.")

# 모델 가중치 로드
try:
    # safetensors 대신 PyTorch 방식으로 로드 시도
    checkpoint = torch.load(f"{model_path}/pytorch_model.bin", map_location='cpu')
    model.load_state_dict(checkpoint)
except FileNotFoundError:
    try:
        # Transformers 방식으로 시도
        from safetensors.torch import load_file
        model_weights = load_file(f"{model_path}/model.safetensors")
        model.load_state_dict(model_weights)
    except Exception as e:
        print(f"❌ 모델 로드 실패: {e}")
        raise

model.eval()
print("✅ 모델 로드 완료!")

def get_emotion_label(valence, arousal):
    """
    Russell의 감정 모델에 기반하여 valence, arousal 값을 감정 레이블로 변환
    """
    if valence > 0.2:
        if arousal > 0.2:
            return "excited"  # 흥분
        elif arousal < -0.2:
            return "calm"     # 평온
        else:
            return "pleasant" # 즐거움
    elif valence < -0.2:
        if arousal > 0.2:
            return "angry"    # 분노
        elif arousal < -0.2:
            return "sad"      # 슬픔
        else:
            return "unpleasant" # 불쾌
    else:
        if arousal > 0.2:
            return "tense"    # 긴장
        elif arousal < -0.2:
            return "relaxed"  # 이완
        else:
            return "neutral"  # 중립

def analyze_sentiment(text: str):
    """
    2차원 감정 회귀 모델을 사용하여 텍스트의 감정을 분석합니다.
    
    Returns:
        dict: {
            "valence": float (-1 to 1, 부정적 -> 긍정적),
            "arousal": float (-1 to 1, 낮은 각성 -> 높은 각성),
            "emotion_label": str (Russell 모델 기반 감정 레이블),
            "confidence": float (예측 신뢰도)
        }
    """
    if not text:
        return {
            "valence": 0.0,
            "arousal": 0.0,
            "emotion_label": "neutral",
            "confidence": 1.0
        }

    try:
        # 텍스트 전처리 및 토크나이징
        query = f"query: {text}"
        tokenized_input = tokenizer(
            query, 
            max_length=128, 
            truncation=True, 
            padding="max_length", 
            return_tensors="pt"
        )
        
        # 모델 예측
        with torch.no_grad():
            outputs = model(
                input_ids=tokenized_input["input_ids"],
                attention_mask=tokenized_input["attention_mask"]
            )
            
            # valence, arousal 값 추출
            valence, arousal = outputs[0].numpy()
            
            # 감정 레이블 생성
            emotion_label = get_emotion_label(valence, arousal)
            
            # 신뢰도 계산 (0에서 멀수록 높은 신뢰도)
            confidence = min(1.0, (abs(valence) + abs(arousal)) / 2.0 + 0.3)
            
            return {
                "valence": float(valence),
                "arousal": float(arousal),
                "emotion_label": emotion_label,
                "confidence": float(confidence)
            }

    except Exception as e:
        print(f"Error during sentiment analysis: {e}")
        return {
            "valence": 0.0,
            "arousal": 0.0,
            "emotion_label": "error",
            "confidence": 0.0
        }