# back/rl_core/rl_model.py

import torch
import torch.nn as nn
import torch.optim as optim
from torch.distributions import Categorical # 이산 행동 공간을 위한 분포
import numpy as np
from typing import Dict, Any, List, Tuple
import os # 모델 저장 경로 관리를 위해 임포트

class PPOConfig:
    """PPO 학습 관련 설정을 정의하는 클래스"""
    GAMMA = 0.99  # 할인율 (Discount Factor)
    GAE_LAMBDA = 0.95 # GAE (Generalized Advantage Estimation) 람다
    CLIP_EPSILON = 0.2 # PPO 클리핑 파라미터
    PPO_EPOCHS = 10 # PPO 업데이트 반복 횟수
    BATCH_SIZE = 64 # 학습 배치 사이즈
    LEARNING_RATE = 3e-4 # 학습률
    ENTROPY_BETA = 0.01 # 엔트로피 항 가중치 (탐험 유도)
    
    # RL 환경 설정 (RLConfig와 동일하게)
    MAX_ROWS = 3
    MAX_COLS = 4
    MAX_CARDS_IN_LAYOUT = MAX_ROWS * MAX_COLS
    NUM_CARD_FEATURES = 2
    NUM_USER_FEATURES = 2
    STATE_DIM = NUM_USER_FEATURES + 1 + 1 + (MAX_CARDS_IN_LAYOUT * NUM_CARD_FEATURES) + (MAX_ROWS * MAX_COLS)
    ACTION_SPACE_SIZE = MAX_ROWS * MAX_COLS

class PPOModel(nn.Module):
    """
    PPO (Proximal Policy Optimization) 모델의 Policy Network 정의.
    상태(State)를 입력받아 행동(Action)을 출력합니다.
    여기서는 '행동'을 '그리드 셀 선택'으로 간주합니다 (이산 행동 공간).
    """
    def __init__(self, state_dim: int, action_dim: int, ppo_config: PPOConfig):
        super(PPOModel, self).__init__()
        self.ppo_config = ppo_config

        # Actor (Policy Network): 상태를 입력받아 각 행동의 로짓(Logits)을 출력
        self.actor = nn.Sequential(
            nn.Linear(state_dim, 256), # 상태 차원에 맞게 첫 레이어 조정
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, action_dim) # action_dim은 그리드 셀의 총 개수
        )
        
        # Critic (Value Network): 상태를 입력받아 해당 상태의 가치(Value)를 출력
        self.critic = nn.Sequential(
            nn.Linear(state_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, 1) # 상태의 가치 (스칼라 값)를 출력
        )

        self.optimizer = optim.Adam(self.parameters(), lr=self.ppo_config.LEARNING_RATE)

    def forward(self, state: torch.Tensor):
        """
        상태를 입력받아 액터(정책)와 크리틱(가치) 네트워크의 출력을 반환합니다.
        """
        action_logits = self.actor(state)
        value = self.critic(state)
        return action_logits, value
    
    def select_action(self, state_vector: np.ndarray, available_actions: List[int]) -> Tuple[int, float]:
        """
        주어진 상태에서 행동을 선택합니다 (학습/추론 시 사용).
        Args:
            state_vector (np.ndarray): 현재 환경 상태를 나타내는 벡터.
            available_actions (List[int]): 현재 유효한 행동 (비어있는 그리드 셀 인덱스) 리스트.
        Returns:
            Tuple[int, float]: 선택된 행동(그리드 셀 인덱스)과 해당 행동의 로그 확률.
        """
        self.eval() # 평가 모드
        state_tensor = torch.FloatTensor(state_vector).unsqueeze(0) # 배치 차원 추가

        with torch.no_grad():
            action_logits, _ = self.forward(state_tensor)
            
            # 유효하지 않은 행동(이미 점유된 셀)에 대해 매우 낮은 확률 부여
            # PPO 학습 시에는 환경에서 유효한 액션만 반환하도록 할 수 있지만,
            # 추론 시에는 이 처리로 무효한 액션 선택을 방지할 수 있습니다.
            mask = torch.ones_like(action_logits) * -1e9 # 매우 작은 값으로 마스킹
            for action_idx in available_actions:
                mask[0, action_idx] = 0 # 유효한 행동은 마스킹 해제

            masked_logits = action_logits + mask
            
            # 확률 분포 생성 (Categorical)
            dist = Categorical(logits=masked_logits)
            action = dist.sample() # 샘플링 (탐험)
            log_prob = dist.log_prob(action)
            
        return action.item(), log_prob.item()

    def evaluate_actions(self, states, actions):
        """
        주어진 상태와 행동에 대해 로그 확률, 엔트로피, 가치 함수를 계산합니다.
        (PPO 학습 시 사용)
        """
        action_logits, values = self.forward(states)
        dist = Categorical(logits=action_logits)
        
        log_probs = dist.log_prob(actions)
        entropy = dist.entropy()
        
        return log_probs, values, entropy
    
    def compute_advantages_and_returns(self, rewards, values, dones):
        """
        GAE (Generalized Advantage Estimation)를 사용하여 Advantage와 Return을 계산합니다.
        """
        advantages = torch.zeros_like(rewards)
        returns = torch.zeros_like(rewards)
        last_gae_lambda = 0
        
        # 마지막 스텝부터 거꾸로 계산
        for t in reversed(range(len(rewards))):
            if t == len(rewards) - 1:
                # 마지막 스텝: done 상태라면 다음 가치 0, 아니면 현재 가치 사용
                next_value = 0 if dones[t] else values[t] # values[t]가 next_state_value를 의미할 경우
                next_non_terminal = 1.0 - dones[t]
            else:
                next_value = values[t+1]
                next_non_terminal = 1.0 - dones[t+1] # t+1의 done 여부

            delta = rewards[t] + self.ppo_config.GAMMA * next_value * next_non_terminal - values[t]
            last_gae_lambda = delta + self.ppo_config.GAMMA * self.ppo_config.GAE_LAMBDA * next_non_terminal * last_gae_lambda
            advantages[t] = last_gae_lambda
            
        returns = advantages + values # Returns = Advantages + Values

        return advantages, returns
    
    def update(self, buffer_states, buffer_actions, buffer_log_probs, buffer_advantages, buffer_returns):
        """
        PPO 알고리즘을 사용하여 모델을 업데이트합니다.
        """
        # 기존 PPO 업데이트 로직...
        return 0.0  # 임시 반환값

    def simple_update(self, states: List[np.ndarray], rewards: List[float]) -> float:
        """
        배치 학습을 위한 간단한 업데이트 메서드
        Args:
            states: 상태 벡터 리스트
            rewards: 보상 리스트
        Returns:
            float: 평균 손실
        """
        if not states or not rewards:
            return 0.0
            
        self.train()  # 학습 모드
        
        total_loss = 0.0
        num_updates = 0
        
        for state, reward in zip(states, rewards):
            try:
                # 상태를 텐서로 변환
                state_tensor = torch.FloatTensor(state).unsqueeze(0)
                reward_tensor = torch.FloatTensor([reward])
                
                # 순전파
                action_logits, value = self.forward(state_tensor)
                
                # 간단한 손실 계산 (MSE for value, cross-entropy for policy)
                value_loss = nn.MSELoss()(value.squeeze(), reward_tensor)
                
                # 정책 손실 (간단한 형태)
                dist = Categorical(logits=action_logits)
                action = dist.sample()
                log_prob = dist.log_prob(action)
                policy_loss = -log_prob * reward_tensor  # REINFORCE 스타일
                
                # 전체 손실
                loss = value_loss + 0.5 * policy_loss
                
                # 역전파
                self.optimizer.zero_grad()
                loss.backward()
                self.optimizer.step()
                
                total_loss += loss.item()
                num_updates += 1
                
            except Exception as e:
                print(f"⚠️ 단일 업데이트 실패: {e}")
                continue
        
        return total_loss / num_updates if num_updates > 0 else 0.0

    def predict_action(self, state_vector: np.ndarray, 
                       selected_card_ids: List[str], 
                       max_rows: int, max_cols: int,
                       grid_state_initial: np.ndarray) -> Dict[str, Dict[str, int]]:
        """
        주어진 상태 벡터를 기반으로 강화학습 모델이 레이아웃을 추론합니다.
        여러 카드를 순차적으로 배치하는 방식을 사용합니다.
        
        Args:
            state_vector (np.ndarray): 현재 환경 상태를 나타내는 초기 상태 벡터 (reset 시점의 상태).
            selected_card_ids (List[str]): 사용자가 선택한 카드 ID 리스트.
            max_rows (int): 레이아웃의 최대 행 수.
            max_cols (int): 레이아웃의 최대 열 수.
            grid_state_initial (np.ndarray): reset 시점의 초기 그리드 상태 (보통 모두 0).

        Returns:
            Dict[str, Dict[str, int]]: 추천된 레이아웃.
                                       예: { "card_id_A": {"row": 0, "col": 0}, ... }
        """
        self.eval() # 평가 모드로 설정
        
        current_grid_state = np.copy(grid_state_initial) # 그리드 상태를 추론 과정에서 업데이트
        current_state_vector = state_vector # 현재 상태 벡터 (계속 업데이트됨)
        
        recommended_layout: Dict[str, Dict[str, int]] = {}
        
        num_cards_to_place = len(selected_card_ids)
        
        for i, card_id in enumerate(selected_card_ids):
            # 현재 유효한 행동 (비어있는 그리드 셀) 목록 생성
            available_actions_indices = []
            for r in range(max_rows):
                for c in range(max_cols):
                    if current_grid_state[r, c] == 0: # 비어있는 셀만
                        available_actions_indices.append(r * max_cols + c) # 1차원 인덱스

            if not available_actions_indices:
                # 더 이상 배치할 공간이 없으면 중단
                print(f"No more available cells to place card {card_id}.")
                break
            
            # 모델로부터 행동(그리드 셀 인덱스) 선택
            # select_action은 이제 available_actions를 고려하여 마스킹된 로짓에서 샘플링함
            # 이 함수는 학습시에도 쓰여야 하므로, log_prob도 반환함. 추론시에는 log_prob은 필요없음.
            action_idx, _ = self.select_action(current_state_vector, available_actions_indices)
            
            row = action_idx // max_cols
            col = action_idx % max_cols

            # 선택된 위치에 카드 배치
            recommended_layout[card_id] = {'row': row, 'col': col, 'order_index': i}
            current_grid_state[row, col] = 1 # 그리드 상태 업데이트

            # 다음 카드를 위한 상태 벡터 업데이트 (현재 카드 인덱스 및 그리드 상태 반영)
            # rl_env의 _get_state_vector를 직접 호출하는 방식이 아니므로, 수동으로 업데이트
            # 여기서는 state_vector의 그리드 부분만 업데이트
            
            # current_state_vector는 numpy 배열이므로, 슬라이싱으로 직접 업데이트
            # STATE_DIM = NUM_USER_FEATURES(2) + current_card_idx(1) + num_cards_feature(1) + card_features_padded(...) + grid_flat(...)
            
            # 그리드 부분의 시작 인덱스 계산 (state_dim 계산식에 따라)
            grid_start_idx = self.ppo_config.STATE_DIM - (max_rows * max_cols)
            current_state_vector[grid_start_idx:] = current_grid_state.flatten().astype(np.float32)

            # 다음 카드 인덱스 업데이트 (state_vector의 current_card_idx_feature 부분)
            # current_card_idx_feature는 user_features 바로 뒤에 위치
            current_card_idx_feature_idx = self.ppo_config.NUM_USER_FEATURES
            current_state_vector[current_card_idx_feature_idx] = (i + 1) / self.ppo_config.MAX_CARDS_IN_LAYOUT


        return recommended_layout

    def save_model(self, path: str):
        """모델 가중치를 저장합니다."""
        torch.save(self.state_dict(), path)
        print(f"Model saved to {path}")

    def load_model(self, path: str):
        """저장된 모델 가중치를 로드합니다."""
        if not os.path.exists(path):
            print(f"Warning: Model file not found at {path}. Model not loaded. Initializing fresh model.")
            return # 파일이 없으면 로드하지 않고 초기화된 상태 유지
        try:
            self.load_state_dict(torch.load(path))
            self.eval() # 평가 모드로 설정
            print(f"Model loaded from {path}")
        except Exception as e:
            print(f"Error loading model from {path}: {e}. Initializing fresh model.")