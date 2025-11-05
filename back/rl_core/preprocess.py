# back/rl_core/preprocess.py

import numpy as np
from typing import List, Dict, Any, Tuple

# 이 파일은 현재 rl_env.py의 _get_state_vector 내부에 통합되어 있습니다.
# 하지만 나중에 전처리 로직이 복잡해지면 _get_state_vector 내부에서 이 모듈의 함수들을 호출하도록 분리할 수 있습니다.

# 예시: 특정 카드 특징을 벡터화하는 함수 (현재는 rl_env.py에 통합되어 있음)
def vectorize_card_features(card_data: Dict[str, Any]) -> List[float]:
    """
    단일 카드의 특징을 수치형 벡터로 변환합니다.
    """
    has_image = 1.0 if card_data.get('image_url') else 0.0
    has_content = 1.0 if card_data.get('content') else 0.0
    # TODO: 카테고리 (source, category)를 원-핫 인코딩 등 추가 가능
    return [has_image, has_content]

def get_padded_card_features_vector(
    selected_cards_data: List[Dict[str, Any]], 
    max_cards_in_layout: int, 
    num_card_features: int
) -> np.ndarray:
    """
    선택된 모든 카드의 특징 벡터를 생성하고, 최대 카드 개수에 맞춰 패딩 또는 트렁케이션합니다.
    """
    card_features_list = [vectorize_card_features(card) for card in selected_cards_data]
    flat_card_features = np.array(card_features_list).flatten()
    
    expected_dim = max_cards_in_layout * num_card_features
    if len(flat_card_features) < expected_dim:
        padded_features = np.pad(flat_card_features, (0, expected_dim - len(flat_card_features)), 'constant')
    elif len(flat_card_features) > expected_dim:
        padded_features = flat_card_features[:expected_dim]
    else:
        padded_features = flat_card_features
    
    return padded_features

# 예시: 사용자 프로필 특징을 벡터화하는 함수 (현재는 rl_env.py에 통합되어 있음)
def vectorize_user_profile(user_profile_data: Dict[str, Any]) -> np.ndarray:
    """
    사용자 프로필 데이터를 수치형 벡터로 변환합니다.
    """
    user_features = np.array([
        user_profile_data.get('average_satisfaction', 0.5),
        user_profile_data.get('total_diaries', 1.0) / 100.0
    ])
    return user_features

# 참고: 현재 rl_env.py의 _get_state_vector는 이 함수들의 로직을 직접 포함하고 있습니다.
# 나중에 전처리 로직이 복잡해지면, rl_env.py에서 위 함수들을 호출하도록 리팩토링할 수 있습니다.