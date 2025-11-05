# back/rl_core/train_script.py

import sys
import os
import torch
import numpy as np
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
import asyncio # 비동기 실행을 위해 임포트

# 프로젝트 루트 경로를 Python Path에 추가 (상대 경로 임포트 문제 해결)
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
project_root = os.path.dirname(parent_dir)

sys.path.insert(0, project_root)
sys.path.insert(0, parent_dir)


# Supabase 클라이언트 임포트
from back.db.connect import supabase
# DB 모델 임포트
from back.models.db_models import User, Card, RewardLog, LayoutLog 
# RL Core 모듈 임포트
from back.rl_core.rl_env import RLEnvironment, RLConfig
from back.rl_core.rl_model import PPOModel, PPOConfig


# --- 데이터 로드 함수 ---
async def fetch_user_data(user_id: str) -> Optional[Dict[str, Any]]:
    """Supabase에서 특정 사용자 데이터를 조회합니다. Dict 형태로 반환."""
    try:
        response = await supabase.table('users').select('*').eq('id', user_id).limit(1).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Error fetching user data for {user_id}: {e}")
        return None

async def fetch_all_cards_data() -> Dict[str, Dict[str, Any]]:
    """Supabase에서 모든 카드 데이터를 조회합니다. Dict[card_id_str, card_data_dict] 형태로 반환."""
    try:
        response = await supabase.table('cards').select('*').execute()
        cards_dict = {card['id']: card for card in response.data}
        return cards_dict
    except Exception as e:
        print(f"Error fetching all cards data: {e}")
        return {}

async def fetch_reward_logs(days_ago: int = 60) -> List[RewardLog]:
    """지정된 기간 동안의 보상 로그를 조회합니다."""
    try:
        n_days_ago = datetime.now() - timedelta(days=days_ago)
        response = await supabase.table('reward_logs').select('*').gte('created_at', n_days_ago.isoformat()).order('created_at', desc=True).execute()
        return [RewardLog(**log) for log in response.data]
    except Exception as e:
        print(f"Error fetching reward logs: {e}")
        return []

async def fetch_layout_logs(days_ago: int = 60) -> List[LayoutLog]:
    """지정된 기간 동안의 레이아웃 로그를 조회합니다."""
    try:
        n_days_ago = datetime.now() - timedelta(days=days_ago)
        response = await supabase.table('layout_logs').select('*').gte('created_at', n_days_ago.isoformat()).order('created_at', desc=True).execute()
        return [LayoutLog(**log) for log in response.data]
    except Exception as e:
        print(f"Error fetching layout logs: {e}")
        return []

# --- 학습 에피소드 구성 함수 ---
async def create_training_episodes(
    reward_logs: List[RewardLog], 
    layout_logs: List[LayoutLog], 
    all_cards_data: Dict[str, Dict[str, Any]], 
    rl_env: RLEnvironment
) -> List[Dict[str, Any]]:
    """
    Supabase 로그를 기반으로 PPO 학습에 사용될 에피소드를 구성합니다.
    각 에피소드는 (상태, 행동, 보상, 다음_상태, 종료_여부) 트랜지션의 시퀀스입니다.
    """
    episodes_data = []
    
    # layout_logs를 diary_id로 그룹화
    layout_logs_by_diary_id = {log.diary_id: log for log in layout_logs}
    
    for r_log in reward_logs:
        diary_id = r_log.diary_id
        if diary_id not in layout_logs_by_diary_id:
            continue # 해당 레이아웃 로그가 없으면 스킵

        l_log = layout_logs_by_diary_id[diary_id]
        
        # 유저 데이터 미리 로드 (캐싱 필요시 개선)
        user_profile_data = await fetch_user_data(l_log.user_id)
        if not user_profile_data:
            print(f"Skipping diary {diary_id}: User {l_log.user_id} not found.")
            continue

        # selected_card_ids 추출 (layout_logs의 generated_layout 키에서 가져옴)
        # generated_layout은 Dict[card_id, Dict[row, col, order_index]] 형태
        selected_card_ids = list(l_log.generated_layout.keys())
        if not selected_card_ids:
            print(f"Skipping diary {diary_id}: No cards in generated layout.")
            continue
            
        # 단일 에피소드 버퍼 (각 카드 배치 스텝)
        episode_buffer = {
            "states": [], "actions": [], "log_probs": [], 
            "rewards": [], "dones": [], "user_final_layout": l_log.final_layout # 최종 레이아웃을 저장하여 나중에 보상 계산에 활용
        }
        
        # 환경 초기화 (에피소드 시작)
        initial_state = rl_env.reset(
            user_id=l_log.user_id, 
            selected_card_ids=selected_card_ids,
            all_cards_data_raw=all_cards_data,
            user_profile_data_raw=user_profile_data
        )
        current_state = initial_state
        
        # 이 시뮬레이션에서는 'AI가 추천한 레이아웃'을 그대로 '행동'으로 간주합니다.
        # 즉, AI는 l_log.generated_layout에 기록된 대로 카드를 배치했다고 가정하고 학습합니다.
        # 실제 PPO 환경의 step 함수와는 약간 다른 방식으로 데이터를 구성합니다.
        
        placed_cells = np.zeros((rl_env.config.MAX_ROWS, rl_env.config.MAX_COLS), dtype=np.int32)
        
        # generated_layout에 있는 카드들을 순서대로 처리 (order_index 활용)
        # order_index가 없는 경우, 임의의 순서로 처리
        sorted_generated_layout_items = sorted(
            l_log.generated_layout.items(), 
            key=lambda item: item[1].get('order_index', 0)
        )

        done = False
        step_rewards = [] # 각 스텝의 보상 (나중에 누적)

        for i, (card_id, layout_info) in enumerate(sorted_generated_layout_items):
            if done: # 이전 스텝에서 종료되었다면 (예: 유효하지 않은 행동으로)
                break

            target_row = layout_info.get('row')
            target_col = layout_info.get('col')

            if target_row is None or target_col is None:
                print(f"Warning: Missing row/col for card {card_id} in diary {diary_id}. Skipping.")
                continue

            action_idx = target_row * rl_env.config.MAX_COLS + target_col

            # 해당 행동이 유효한지 검사
            if placed_cells[target_row, target_col] == 1:
                # 이미 점유된 칸에 배치 시도: 유효하지 않은 행동
                current_reward = rl_env.config.REWARD_INVALID_ACTION
                done = True
                print(f"Diary {diary_id}: Invalid action during data creation - cell ({target_row}, {target_col}) already occupied.")
            else:
                placed_cells[target_row, target_col] = 1 # 그리드 상태 업데이트
                current_reward = 1.0 # 각 카드 배치 성공에 대한 작은 보상 (학습의 안정성을 위해)
                
                # 가상의 next_state 계산을 위해 임시로 그리드 상태 업데이트 후 _get_state_vector 호출
                temp_env = RLEnvironment(rl_env.config) # 환경 객체 복사 (deep copy 대신 간단히 새로 생성)
                temp_env.current_user_id = l_log.user_id
                temp_env.selected_cards_data = rl_env.selected_cards_data
                temp_env.num_selected_cards = rl_env.num_selected_cards
                temp_env.user_profile_data = user_profile_data
                temp_env.grid_state = np.copy(placed_cells)
                temp_env.current_card_index_to_place = i + 1 # 다음 카드 인덱스

                next_state_sim = temp_env._get_state_vector()
                
                # 에피소드 버퍼에 추가
                episode_buffer["states"].append(current_state)
                episode_buffer["actions"].append(action_idx)
                # log_prob은 PPOModel의 evaluate_actions에서 계산해야 함. 여기서는 더미 0.0
                episode_buffer["log_probs"].append(0.0) 
                episode_buffer["dones"].append(False) # 각 스텝은 일반적으로 done이 아님. 최종 단계에서만 True

                current_state = next_state_sim # 상태 업데이트
                step_rewards.append(current_reward)
                
                if i == len(selected_card_ids) - 1: # 마지막 카드 배치
                    done = True
                    episode_buffer["dones"][-1] = True # 마지막 스텝의 done을 True로
                
            if done: # 유효하지 않은 행동이나 마지막 카드 배치로 에피소드 조기 종료
                break
        
        # 최종 보상 (RewardLog)을 마지막 스텝에 반영
        if episode_buffer["states"]: # 스텝이 하나라도 있었으면
            # accumulate rewards and append total reward to the last step's reward
            final_feedback_reward = rl_env.calculate_reward(r_log.feedback_type, {'original_layout': l_log.generated_layout, 'final_layout': l_log.final_layout})
            
            # 모든 스텝 보상에 최종 보상을 더하는 방식 (누적)
            # 또는 마지막 스텝에만 최종 보상을 주는 방식
            # 여기서는 모든 스텝에 최종 보상 분배 (혹은 마지막 스텝에 집중)
            # PPO는 최종 누적 보상을 바탕으로 학습하므로, 스텝별 보상과 최종 보상 합산
            if done:
                 step_rewards[-1] += final_feedback_reward # 최종 보상을 마지막 스텝에 더함

            episode_buffer["rewards"] = step_rewards # 스텝별 보상 리스트

            episodes_data.append(episode_buffer)

    print(f"Created {len(episodes_data)} training episodes.")
    return episodes_data

# --- 학습 스크립트의 메인 로직 ---
async def train_model():
    print("Starting RL model training...")

    # 1. DB에서 데이터 로드
    print("Fetching data from Supabase...")
    reward_logs = await fetch_reward_logs(days_ago=60) # 최근 60일 데이터
    layout_logs = await fetch_layout_logs(days_ago=60)
    all_cards_data_db = await fetch_all_cards_data()
    
    print(f"Fetched {len(reward_logs)} reward logs and {len(layout_logs)} layout logs.")

    # 2. 강화학습 환경 및 모델 초기화
    rl_config = RLConfig()
    ppo_config = PPOConfig()
    rl_env = RLEnvironment(rl_config)
    
    action_dim = rl_config.ACTION_SPACE_SIZE # 그리드 셀의 총 개수
    rl_model = PPOModel(state_dim=rl_config.STATE_DIM, action_dim=action_dim, ppo_config=ppo_config)
    
    # 이전에 학습된 모델이 있다면 로드
    model_checkpoint_path = os.path.join(current_dir, "checkpoints", "layout_policy.pth")
    rl_model.load_model(model_checkpoint_path)

    # 3. 학습 데이터 준비
    print("Creating training episodes from logs...")
    training_episodes = await create_training_episodes(reward_logs, layout_logs, all_cards_data_db, rl_env)

    if not training_episodes:
        print("No training episodes created. Skipping training.")
        return

    # 4. PPO 학습 루프
    print(f"Starting PPO training with {len(training_episodes)} episodes.")

    # PPO는 일반적으로 On-policy 알고리즘이지만, 여기서는 과거 데이터를 사용하는 Off-policy 방식으로 구현
    # 수집된 모든 경험을 한 번에 버퍼에 담아 학습
    buffer_states = []
    buffer_actions = []
    buffer_log_probs = []
    buffer_rewards = []
    buffer_dones = []
    
    # 각 에피소드에서 트랜지션(상태, 행동, 보상, 다음 상태, 종료 여부) 추출
    for episode in training_episodes:
        episode_states = []
        episode_actions = []
        episode_log_probs = []
        episode_rewards = []
        episode_dones = []
        
        # PPO 학습을 위해, 실제 발생한 '행동'에 대한 log_prob을 재계산해야 합니다.
        # 이전에 generated_layout에 기록된 레이아웃은 모델이 그 시점에 '취한 행동'으로 간주.
        
        # rl_env.reset()으로 초기 상태를 생성하여 모델에 입력
        # 실제 환경에서 AI가 step을 밟아가며 레이아웃을 완성한 데이터를 만드는 과정 시뮬레이션
        # 훈련 데이터셋 구성시: (state, action, reward, next_state, done)
        
        # 에피소드 버퍼 데이터를 PPO 모델 학습에 맞게 변환
        # 각 step마다 (state, action, reward, next_state, done)을 기록하고, 
        # 나중에 advantage와 return을 계산하여 PPO 업데이트
        
        current_grid_state_for_log_prob = np.zeros((rl_config.MAX_ROWS, rl_config.MAX_COLS), dtype=np.int32)
        
        for i in range(len(episode["states"])): # episode["states"]는 이미 _get_state_vector로 생성된 상태
            state = episode["states"][i]
            action = episode["actions"][i]
            reward = episode["rewards"][i]
            done = episode["dones"][i]
            
            # 이전에 해당 상태에서 모델이 이 액션을 취했을 때의 log_prob을 추정
            # 실제 PPO에서는 'old_log_probs'를 버퍼에 저장하고 업데이트에 사용
            # 여기서는 학습 데이터에서 가져온 'action'에 대한 log_prob을 모델을 통해 계산
            
            # 임시로 유효한 액션 (현재 그리드 상태 기반)
            temp_available_actions = []
            temp_grid_state = np.copy(current_grid_state_for_log_prob)
            
            for r in range(rl_config.MAX_ROWS):
                for c in range(rl_config.MAX_COLS):
                    if temp_grid_state[r, c] == 0:
                        temp_available_actions.append(r * rl_config.MAX_COLS + c)
            
            # 모델을 사용하여 log_prob 계산
            # 주의: 이 과정에서 모델은 아직 완전히 학습되지 않았을 수 있음
            # on-policy PPO에서는 액션 선택과 동시에 log_prob을 기록함
            # off-policy 학습에서는 replay buffer에서 샘플링 후 log_prob 재계산
            
            # 모델의 eval() 모드에서 log_prob 계산 (정책 변화 반영 X)
            rl_model.eval()
            with torch.no_grad():
                state_tensor = torch.FloatTensor(state).unsqueeze(0)
                action_tensor = torch.LongTensor([action])
                
                # 유효한 액션 마스킹 적용
                mask = torch.ones(rl_config.ACTION_SPACE_SIZE) * -1e9
                for valid_action_idx in temp_available_actions:
                    mask[valid_action_idx] = 0
                
                action_logits, values = rl_model.forward(state_tensor)
                masked_logits = action_logits + mask.unsqueeze(0)
                dist = Categorical(logits=masked_logits)
                
                log_prob = dist.log_prob(action_tensor).item()
                value = values.item()
            
            episode_states.append(state)
            episode_actions.append(action)
            episode_log_probs.append(log_prob)
            episode_rewards.append(reward)
            episode_dones.append(done) # 마지막 스텝만 True

            # 그리드 상태 업데이트 (다음 스텝의 'temp_available_actions'에 영향)
            row = action // rl_config.MAX_COLS
            col = action % rl_config.MAX_COLS
            if 0 <= row < rl_config.MAX_ROWS and 0 <= col < rl_config.MAX_COLS: # 유효성 검사
                current_grid_state_for_log_prob[row, col] = 1

        # 에피소드 종료 후, Advantage와 Return 계산
        # values는 상태 가치 함수 값 (크리틱 네트워크 출력)
        # 이 부분이 실제 강화학습 트랜지션의 핵심. 학습 데이터는 (state, action, reward, next_state, done)
        # PPO는 (state, action, old_log_prob, advantage, return)을 사용.
        # 그래서 values도 다시 계산해야 함.
        
        # 전체 에피소드의 states에 대해 value 예측
        if not episode_states: # 에피소드 데이터가 없으면 스킵
            continue

        with torch.no_grad():
            episode_states_tensor = torch.FloatTensor(np.array(episode_states))
            _, values_tensor = rl_model.forward(episode_states_tensor)
            episode_values = values_tensor.squeeze(1).numpy()
        
        # compute_advantages_and_returns는 numpy 배열이 아닌 torch tensor를 입력으로 받음
        advantages, returns = rl_model.compute_advantages_and_returns(
            torch.FloatTensor(np.array(episode_rewards)), 
            torch.FloatTensor(np.array(episode_values)), 
            torch.BoolTensor(np.array(episode_dones)) # dones는 boolean tensor
        )

        buffer_states.extend(episode_states)
        buffer_actions.extend(episode_actions)
        buffer_log_probs.extend(episode_log_probs)
        buffer_rewards.extend(episode_rewards) # 이 부분은 PPO 학습에 직접 쓰이지 않지만 디버깅용
        buffer_dones.extend(episode_dones) # 이 부분도 직접 쓰이지 않지만 디버깅용

    if not buffer_states:
        print("No valid data for PPO training. Buffer is empty.")
        return

    # PPO 모델 업데이트
    print(f"Updating PPO model with {len(buffer_states)} total experiences.")
    rl_model.update(
        buffer_states, 
        buffer_actions, 
        buffer_log_probs, 
        advantages.numpy(), # advantages, returns는 이미 torch tensor이므로 numpy로 변환
        returns.numpy()
    )

    print("PPO training finished.")

    # 5. 학습된 모델 저장
    os.makedirs(os.path.dirname(model_checkpoint_path), exist_ok=True)
    rl_model.save_model(model_checkpoint_path)
    print("Training complete. Model saved.")

if __name__ == "__main__":
    asyncio.run(train_model())