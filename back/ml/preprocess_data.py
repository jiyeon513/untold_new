# back/ml/preprocess_data.py (VA 맵핑 추가 최종 버전)
from datasets import load_dataset
import pandas as pd

def run_kote_regression_preprocessing():
    """
    KOTE 데이터셋을 로드하고, 44개 감정 레이블을 Valence/Arousal 점수로 맵핑하여
    2D 감정 회귀 모델 학습을 위한 CSV 파일을 생성합니다.
    """
    DATASET_NAME = "searle-j/kote"
    try:
        print(f"Hugging Face에서 '{DATASET_NAME}' 데이터셋을 다운로드합니다...")
        dataset = load_dataset(DATASET_NAME, trust_remote_code=True)
        print("데이터셋 다운로드 완료!")

        # KOTE 데이터셋의 44개 감정 레이블 목록
        id_to_label = {idx: label for idx, label in enumerate(['불평/불만', '환영/호의', '감동/감탄', '지긋지긋', '고마움', '슬픔', '화남/분노', '존경', '기대감', '우쭐댐/무시함', '안타까움/실망', '비장함', '의심/불신', '뿌듯함', '편안/쾌적', '신기함/관심', '아껴주는', '부끄러움', '공포/무서움', '절망', '한심함', '역겨움/징그러움', '짜증', '어이없음', '없음', '패배/자기혐오', '귀찮음', '힘듦/지침', '즐거움/신남', '깨달음', '죄책감', '증오/혐오', '흐뭇함(귀여움/예쁨)', '당황/난처', '경악', '부담/안_내킴', '질투', '존중', '신뢰', '실망', '연민', '후회', '혐오', '놀람'])}
        
        # === 핵심: 44개 감정 레이블을 Valence, Arousal 점수로 맵핑 ===
        # 이 점수는 연구나 논문을 참고하여 더 정교하게 수정할 수 있습니다. (시작을 위한 예시)
        emotion_to_va_map = {
            '기쁨': [0.8, 0.6], '즐거움/신남': [0.9, 0.8], '환영/호의': [0.7, 0.4], '감동/감탄': [0.7, 0.7], 
            '고마움': [0.8, 0.3], '존경': [0.6, 0.4], '뿌듯함': [0.8, 0.2], '편안/쾌적': [0.6, -0.3],
            '아껴주는': [0.7, 0.2], '신기함/관심': [0.4, 0.6], '기대감': [0.5, 0.5], '깨달음': [0.3, 0.2],
            '신뢰': [0.7, 0.1], '흐뭇함(귀여움/예쁨)': [0.8, 0.1], '존중': [0.6, 0.2],
            
            '슬픔': [-0.7, -0.5], '화남/분노': [-0.6, 0.8], '불평/불만': [-0.5, 0.3], '지긋지긋': [-0.8, 0.1],
            '안타까움/실망': [-0.6, -0.2], '절망': [-0.9, -0.6], '한심함': [-0.5, 0.2], '역겨움/징그러움': [-0.8, 0.3],
            '짜증': [-0.5, 0.5], '어이없음': [-0.2, 0.4], '패배/자기혐오': [-0.8, -0.4], '귀찮음': [-0.4, -0.6],
            '힘듦/지침': [-0.6, -0.7], '죄책감': [-0.7, -0.1], '증오/혐오': [-0.9, 0.7], '부담/안_내킴': [-0.3, -0.2],
            '질투': [-0.6, 0.5], '실망': [-0.7, -0.3], '연민': [-0.2, -0.3], '후회': [-0.6, -0.4], '혐오': [-0.9, 0.6],

            '공포/무서움': [-0.5, 0.7], '부끄러움': [-0.3, 0.1], '당황/난처': [-0.2, 0.6], '경악': [-0.1, 0.9], '놀람': [0.1, 0.8],
            
            '의심/불신': [-0.4, 0.1], '비장함': [0.1, 0.7], '우쭐댐/무시함': [-0.2, 0.3],
            
            '없음': [0.0, 0.0] # 중립
        }

        print("데이터를 Valence, Arousal 점수로 변환합니다...")
        
        processed_data = []
        for item in dataset['train']:
            # 각 문장에 포함된 여러 감정들의 VA 점수를 평균냅니다.
            valence_scores = []
            arousal_scores = []
            
            for label_id in item['labels']:
                label_name = id_to_label.get(label_id)
                if label_name in emotion_to_va_map:
                    va_scores = emotion_to_va_map[label_name]
                    valence_scores.append(va_scores[0])
                    arousal_scores.append(va_scores[1])
            
            if valence_scores: # 하나 이상의 유효한 감정이 있을 경우
                avg_valence = sum(valence_scores) / len(valence_scores)
                avg_arousal = sum(arousal_scores) / len(arousal_scores)
                
                processed_data.append({
                    "text": item['text'],
                    "valence": avg_valence,
                    "arousal": avg_arousal
                })

        df = pd.DataFrame(processed_data)
        train_df = df.sample(frac=0.8, random_state=42)
        validation_df = df.drop(train_df.index)
        
        train_path = "back/ml/kote_regression_train.csv"
        validation_path = "back/ml/kote_regression_validation.csv"
        
        train_df.to_csv(train_path, index=False, encoding='utf-8-sig')
        validation_df.to_csv(validation_path, index=False, encoding='utf-8-sig')
        
        print(f"'{train_path}' 와 '{validation_path}' 파일이 성공적으로 생성되었습니다.")

    except Exception as e:
        print(f"데이터셋 처리 중 오류가 발생했습니다: {e}")
        return

if __name__ == "__main__":
    run_kote_regression_preprocessing()