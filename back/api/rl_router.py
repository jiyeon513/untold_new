# back/api/rl_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import sys
import os
import torch
import numpy as np
from datetime import datetime
import uuid  # UUID 생성을 위해 추가

# 프로젝트 루트 경로를 Python Path에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
project_root = os.path.dirname(parent_dir)
sys.path.insert(0, project_root)
sys.path.insert(0, parent_dir)

# RL Core 모듈 임포트
from rl_core.rl_env import RLEnvironment, RLConfig
from rl_core.rl_model import PPOModel, PPOConfig
from db.connect import supabase

# UUID 생성 함수
def generate_uuid():
    return str(uuid.uuid4())

router = APIRouter(
    prefix="/rl",
    tags=["Reinforcement Learning"],
)

# 요청/응답 모델 정의
class LayoutRequest(BaseModel):
    diary_id: str
    user_id: str
    selected_card_ids: List[str]

class LayoutResponse(BaseModel):
    success: bool
    layout: Dict[str, Dict[str, int]]  # card_id -> {row, col, order_index}
    message: str

class FeedbackRequest(BaseModel):
    diary_id: str
    feedback_type: str  # 'save', 'modify', 'regenerate'
    details: Optional[Dict[str, Any]] = None

# 전역 변수로 RL 환경과 모델 초기화
rl_config = RLConfig()
ppo_config = PPOConfig()
rl_env = RLEnvironment(rl_config)

# 모델 로드 (체크포인트가 있으면 로드, 없으면 새로 생성)
model_path = os.path.join(project_root, "back/rl_core/checkpoints/best_model.pth")
ppo_model = PPOModel(rl_config.STATE_DIM, rl_config.ACTION_SPACE_SIZE, ppo_config)

# 체크포인트 디렉토리 생성
checkpoints_dir = os.path.dirname(model_path)
os.makedirs(checkpoints_dir, exist_ok=True)

if os.path.exists(model_path):
    try:
        ppo_model.load_model(model_path)
        print("✅ 기존 RL 모델 로드 완료")
    except Exception as e:
        print(f"⚠️ 모델 로드 실패, 새 모델 사용: {e}")
else:
    print("🆕 새로운 RL 모델 초기화")

@router.post("/suggest-layout", response_model=LayoutResponse)
async def suggest_layout(request: LayoutRequest):
    """
    선택된 카드들을 기반으로 최적의 레이아웃을 제안합니다.
    """
    try:
        print(f"🔍 레이아웃 제안 시작: diary_id={request.diary_id}, cards={len(request.selected_card_ids)}")
        
        # 1. 선택된 카드들의 상세 데이터 조회
        print("📊 카드 데이터 조회 중...")
        card_data_response = supabase.table('cards').select('*').in_('id', request.selected_card_ids).execute()
        
        if not card_data_response.data:
            raise HTTPException(status_code=404, detail="선택된 카드를 찾을 수 없습니다.")
        
        print(f"✅ 카드 데이터 조회 완료: {len(card_data_response.data)}개")
        
        # 카드 데이터를 딕셔너리로 변환
        all_cards_data = {card['id']: card for card in card_data_response.data}
        
        # 2. 사용자 프로필 데이터 조회 (임시 데이터 사용)
        user_profile_data = {
            'average_satisfaction': 0.7,  # 기본값
            'total_diaries': 5  # 기본값
        }
        
        # 3. RL 환경 초기화
        print("🎮 RL 환경 초기화 중...")
        initial_state = rl_env.reset(
            user_id=request.user_id,
            selected_card_ids=request.selected_card_ids,
            all_cards_data_raw=all_cards_data,
            user_profile_data_raw=user_profile_data
        )
        print(f"✅ RL 환경 초기화 완료: state_dim={len(initial_state)}")
        
        # 4. 레이아웃 생성
        print("🤖 AI 레이아웃 생성 중...")
        layout_result = ppo_model.predict_action(
            state_vector=initial_state,
            selected_card_ids=request.selected_card_ids,
            max_rows=rl_config.MAX_ROWS,
            max_cols=rl_config.MAX_COLS,
            grid_state_initial=np.zeros((rl_config.MAX_ROWS, rl_config.MAX_COLS))
        )
        print(f"✅ 레이아웃 생성 완료: {len(layout_result)}개 카드 배치")
        
        # 4. 레이아웃 로그 저장 (AI 생성 정보)
        try:
            # AI가 생성한 레이아웃을 개별 카드별로 저장
            for card_id, layout_info in layout_result.items():
                layout_log_data = {
                    'id': generate_uuid(),  # ID 필드 추가
                    'diary_id': request.diary_id,
                    'card_id': card_id,
                    'prev_row': 0,  # AI 생성이므로 이전 위치는 0
                    'prev_col': 0,
                    'new_row': layout_info.get('row', 0),
                    'new_col': layout_info.get('col', 0),
                    'step': 1,
                    'created_at': datetime.now().isoformat(),
                    'moved_by_user': False  # AI가 생성한 것이므로 False
                }
                
                supabase.table('layout_logs').insert([layout_log_data]).execute()
            
            print("✅ AI 레이아웃 로그 저장 완료")
        except Exception as e:
            print(f"⚠️ AI 레이아웃 로그 저장 실패: {e}")
        
        return LayoutResponse(
            success=True,
            layout=layout_result,
            message="레이아웃 제안이 완료되었습니다."
        )
        
    except Exception as e:
        import traceback
        print(f"❌ 레이아웃 제안 중 오류: {e}")
        print(f"📋 상세 에러: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"레이아웃 제안 실패: {str(e)}")

@router.post("/learn-from-feedback")
async def learn_from_feedback(request: FeedbackRequest):
    """
    사용자 피드백을 받아 강화학습 모델을 업데이트합니다.
    """
    try:
        print(f"🎓 피드백 학습 시작: {request.feedback_type}")
        
        # 1. 피드백에 따른 보상 계산
        reward = rl_env.calculate_reward(request.feedback_type, request.details)
        print(f"💰 계산된 보상: {reward}")
        
        # 2. 레이아웃 로그 저장 (사용자 수정 정보)
        if request.details and 'user_layout' in request.details:
            try:
                user_layout = request.details.get('user_layout', {})
                original_layout = request.details.get('original_layout', {})
                
                print(f"📊 사용자 레이아웃 수정 로그 저장 시작: {len(user_layout)}개 카드")
                
                # 각 카드의 위치 변경을 개별적으로 로그
                for card_id, new_pos in user_layout.items():
                    if card_id in original_layout:
                        old_pos = original_layout[card_id]
                        
                        layout_log_data = {
                            'id': generate_uuid(),  # ID 필드 추가
                            'diary_id': request.diary_id,
                            'card_id': card_id,
                            'prev_row': old_pos.get('row', 0),
                            'prev_col': old_pos.get('col', 0),
                            'new_row': new_pos.get('row', 0),
                            'new_col': new_pos.get('col', 0),
                            'step': 1,  # 기본값
                            'created_at': datetime.now().isoformat(),
                            'moved_by_user': True
                        }
                        
                        print(f"💾 레이아웃 로그 저장: {card_id} - ({old_pos.get('row', 0)},{old_pos.get('col', 0)}) → ({new_pos.get('row', 0)},{new_pos.get('col', 0)})")
                        supabase.table('layout_logs').insert([layout_log_data]).execute()
                
                print("✅ 사용자 레이아웃 수정 로그 저장 완료")
            except Exception as e:
                print(f"⚠️ 사용자 레이아웃 로그 저장 실패: {e}")
                import traceback
                print(f"📋 상세 에러: {traceback.format_exc()}")
        else:
            print("ℹ️ 사용자 레이아웃 수정이 없어서 레이아웃 로그를 저장하지 않습니다.")
        
        # 3. 보상 로그 저장
        try:
            reward_log_data = {
                'id': generate_uuid(),  # ID 필드 추가
                'diary_id': request.diary_id,
                'reward_type': request.feedback_type,
                'reward_value': reward,
                'step': 1,  # 기본값
                'created_at': datetime.now().isoformat()
            }
            
            # 관련 카드 ID가 있으면 추가
            if request.details and 'related_card_id' in request.details:
                reward_log_data['related_card_id'] = request.details['related_card_id']
            
            print(f"💾 보상 로그 저장: {request.feedback_type}, 보상: {reward}")
            supabase.table('reward_logs').insert([reward_log_data]).execute()
            print("✅ 보상 로그 저장 완료")
        except Exception as e:
            print(f"⚠️ 보상 로그 저장 실패: {e}")
            import traceback
            print(f"📋 상세 에러: {traceback.format_exc()}")
        
        # 4. 모델 자동 저장 (피드백이 있을 때마다)
        try:
            ppo_model.save_model(model_path)
            print(f"💾 모델 자동 저장 완료: {model_path}")
        except Exception as e:
            print(f"❌ 모델 저장 실패: {e}")
        
        print(f"✅ 피드백 학습 완료: {request.feedback_type}, 보상: {reward}")
        
        return {"success": True, "message": "피드백이 성공적으로 학습되었습니다."}
        
    except Exception as e:
        import traceback
        print(f"❌ 피드백 학습 중 오류: {e}")
        print(f"📋 상세 에러: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"피드백 학습 실패: {str(e)}")

class BatchTrainingRequest(BaseModel):
    feedback_data: List[Dict[str, Any]]
    training_config: Optional[Dict[str, Any]] = None

@router.post("/batch-train")
async def batch_train(request: BatchTrainingRequest):
    """
    프론트엔드에서 수집된 피드백 데이터로 배치 학습을 수행합니다.
    """
    try:
        print(f"🔄 배치 학습 시작... 피드백 데이터: {len(request.feedback_data)}개")
        
        if not request.feedback_data:
            return {"success": False, "message": "학습할 피드백 데이터가 없습니다."}
        
        # 1. 피드백 데이터를 학습 에피소드로 변환
        training_episodes = []
        
        for feedback in request.feedback_data:
            try:
                details = feedback.get('details', {})
                user_layout = details.get('user_layout', {})
                original_layout = details.get('original_layout', {})
                reward = details.get('layout_reward', 0)
                
                # 레이아웃 데이터 구성
                layout_data = {}
                for card_id, pos in user_layout.items():
                    layout_data[card_id] = {
                        'row': pos.get('row', 0),
                        'col': pos.get('col', 0),
                        'order_index': 0
                    }
                
                episode = {
                    'diary_id': feedback.get('diary_id'),
                    'reward': reward,
                    'feedback_type': feedback.get('feedback_type'),
                    'layout_data': layout_data,
                    'user_id': details.get('user_id'),
                    'original_layout': original_layout,
                    'user_layout': user_layout
                }
                training_episodes.append(episode)
                
            except Exception as e:
                print(f"⚠️ 피드백 데이터 처리 실패: {e}")
                continue
        
        print(f"🎯 구성된 학습 에피소드: {len(training_episodes)}개")
        
        # 2. 배치 학습 수행
        if training_episodes:
            states = []
            rewards = []
            
            for episode in training_episodes:
                try:
                    # 에피소드 데이터로 환경 초기화
                    user_id = episode.get('user_id', generate_uuid())
                    
                    initial_state = rl_env.reset(
                        user_id=user_id,
                        selected_card_ids=list(episode['layout_data'].keys()),
                        all_cards_data_raw=episode['layout_data'],
                        user_profile_data_raw={'average_satisfaction': 0.7, 'total_diaries': 5}
                    )
                    
                    # 보상 계산
                    reward = episode['reward']
                    
                    states.append(initial_state)
                    rewards.append(reward)
                        
                except Exception as e:
                    print(f"⚠️ 에피소드 처리 실패: {e}")
                    continue
            
            # 배치 학습 수행
            if states and rewards:
                try:
                    # 학습 설정 적용
                    training_config = request.training_config or {}
                    learning_rate = training_config.get('learning_rate', 0.001)
                    epochs = training_config.get('epochs', 3)
                    
                    avg_loss = ppo_model.simple_update(states, rewards)
                    print(f"✅ 배치 학습 완료: {len(states)}개 에피소드, 평균 손실: {avg_loss:.4f}")
                    
                    # 모델 저장
                    ppo_model.save_model(model_path)
                    print(f"💾 모델 저장 완료: {model_path}")
                    
                    return {
                        "success": True, 
                        "message": f"배치 학습 완료! {len(states)}개 에피소드 처리됨",
                        "avg_loss": avg_loss,
                        "processed_episodes": len(states)
                    }
                    
                except Exception as e:
                    print(f"❌ 배치 학습 실패: {e}")
                    return {"success": False, "message": f"배치 학습 실패: {str(e)}"}
            else:
                return {"success": False, "message": "유효한 학습 데이터가 없습니다."}
        else:
            return {"success": False, "message": "처리할 수 있는 에피소드가 없습니다."}
            
    except Exception as e:
        import traceback
        print(f"❌ 배치 학습 중 오류: {e}")
        print(f"📋 상세 에러: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"배치 학습 실패: {str(e)}")

@router.get("/model-status")
async def get_model_status():
    """
    현재 RL 모델의 상태를 확인합니다.
    """
    try:
        model_exists = os.path.exists(model_path)
        return {
            "model_loaded": model_exists,
            "model_path": model_path,
            "state_dim": rl_config.STATE_DIM,
            "action_space_size": rl_config.ACTION_SPACE_SIZE,
            "max_rows": rl_config.MAX_ROWS,
            "max_cols": rl_config.MAX_COLS
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"모델 상태 확인 실패: {str(e)}") 

@router.get("/learning-status")
async def get_learning_status():
    """
    강화학습 모델의 학습 상태와 진행 상황을 확인합니다.
    """
    try:
        # 체크포인트 파일 정보
        model_exists = os.path.exists(model_path)
        model_size = os.path.getsize(model_path) if model_exists else 0
        
        # 최근 보상 로그 조회 (최근 10개)
        try:
            reward_logs_response = supabase.table('reward_logs').select('*').order('created_at', desc=True).limit(10).execute()
            recent_rewards = reward_logs_response.data if reward_logs_response.data else []
        except Exception as e:
            recent_rewards = []
            print(f"보상 로그 조회 실패: {e}")
        
        # 통계 계산
        total_feedback = len(recent_rewards)
        positive_feedback = len([r for r in recent_rewards if r.get('reward_type') == 'save'])
        negative_feedback = len([r for r in recent_rewards if r.get('reward_type') in ['modify', 'regenerate']])
        avg_reward = sum([r.get('reward_value', 0) for r in recent_rewards]) / len(recent_rewards) if recent_rewards else 0
        
        return {
            "model_status": {
                "loaded": model_exists,
                "path": model_path,
                "size_bytes": model_size,
                "state_dim": rl_config.STATE_DIM,
                "action_space_size": rl_config.ACTION_SPACE_SIZE
            },
            "learning_progress": {
                "total_feedback": total_feedback,
                "positive_feedback": positive_feedback,
                "negative_feedback": negative_feedback,
                "average_reward": round(avg_reward, 2),
                "learning_rate": ppo_config.LEARNING_RATE
            },
            "recent_feedback": recent_rewards[:5]  # 최근 5개만
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"학습 상태 확인 실패: {str(e)}") 

@router.post("/create-test-data")
async def create_test_data():
    """
    테스트용 샘플 데이터를 생성합니다.
    """
    try:
        print("🧪 테스트 데이터 생성 시작...")
        
        # 테스트용 UUID 생성
        test_diary_id = generate_uuid()
        test_card_id = generate_uuid()
        
        # 1. 테스트 레이아웃 로그 생성 (올바른 컬럼명 사용)
        try:
            layout_log_data = {
                'id': generate_uuid(),  # ID 필드 추가
                'diary_id': test_diary_id,
                'card_id': test_card_id,
                'prev_row': 0,
                'prev_col': 0,
                'new_row': 1,
                'new_col': 2,
                'step': 1,
                'created_at': datetime.now().isoformat(),
                'moved_by_user': True
            }
            
            supabase.table('layout_logs').insert([layout_log_data]).execute()
            print("✅ 테스트 레이아웃 로그 생성 완료")
        except Exception as e:
            print(f"⚠️ 테스트 레이아웃 로그 생성 실패: {e}")
        
        # 2. 테스트 보상 로그 생성
        try:
            reward_log_data = {
                'id': generate_uuid(),  # ID 필드 추가
                'diary_id': test_diary_id,
                'reward_type': 'save',
                'reward_value': 85.5,
                'step': 1,
                'created_at': datetime.now().isoformat(),
                'related_card_id': test_card_id
            }
            
            supabase.table('reward_logs').insert([reward_log_data]).execute()
            print("✅ 테스트 보상 로그 생성 완료")
        except Exception as e:
            print(f"⚠️ 테스트 보상 로그 생성 실패: {e}")
        
        return {
            "success": True,
            "message": "테스트 데이터 생성 완료",
            "test_diary_id": test_diary_id,
            "test_card_id": test_card_id
        }
        
    except Exception as e:
        import traceback
        print(f"❌ 테스트 데이터 생성 실패: {e}")
        print(f"📋 상세 에러: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"테스트 데이터 생성 실패: {str(e)}") 