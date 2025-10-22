# NVIDIA DAM-3B-Video 독립 노드 구현 워크플로우

## 📋 전체 개요

**목표**: NVIDIA DAM-3B-Video를 사용하는 독립적인 ComfyUI 커스텀 노드 구현
**특징**: 비디오의 특정 영역(region)에 대한 상세 설명 생성
**예상 작업 시간**: 4-6 시간

---

## 🎯 Phase 1: 환경 설정 및 의존성 설치 (30분)

### 1.1 DAM 라이브러리 설치
```bash
# describe-anything 패키지 설치
cd /Volumes/KIMJUNGHO_SSD/ComfyUI
source .venv/bin/activate
pip install git+https://github.com/NVlabs/describe-anything

# 의존성 확인
pip list | grep -E "torch|transformers|vila|sam"
```

**검증**:
- [ ] `describe-anything` 패키지 설치 확인
- [ ] PyTorch, transformers 버전 호환성 확인
- [ ] VILA 관련 라이브러리 설치 확인

### 1.2 모델 다운로드 디렉토리 준비
```bash
# DAM 모델 저장 경로 생성
mkdir -p models/video_description/DAM-3B-Video

# 모델 크기: 약 7.12GB
# 예상 다운로드 시간: 5-15분 (인터넷 속도에 따라)
```

**검증**:
- [ ] 디렉토리 생성 확인
- [ ] 디스크 여유 공간 10GB 이상 확인

---

## 🔧 Phase 2: 모델 로더 구현 (1-1.5시간)

### 2.1 DAM 모델 캐시 매니저 생성

**파일**: `models/dam_cache.py`

```python
"""
DAM Model Cache Manager
Singleton pattern for DAM-3B-Video model management
"""

import torch
import logging
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class DAMModelCache:
    """Singleton cache for DAM model"""

    _instance = None
    _model = None
    _processor = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def _get_model_path(cls) -> Path:
        """Get DAM model path in ComfyUI models directory"""
        # custom_nodes/ComfyUI-VideoDescription/models/dam_cache.py
        # → ComfyUI/models/video_description/DAM-3B-Video/
        current_file = Path(__file__).resolve()
        custom_nodes_dir = current_file.parent.parent.parent
        comfyui_root = custom_nodes_dir.parent
        model_path = comfyui_root / "models" / "video_description" / "DAM-3B-Video"
        return model_path

    @classmethod
    def get_dam_model(cls, use_4bit: bool = False) -> Tuple:
        """
        Load and cache DAM-3B-Video model

        Args:
            use_4bit: Use 4-bit quantization (not supported yet for DAM)

        Returns:
            Tuple of (model, processor)
        """
        if cls._model is not None and cls._processor is not None:
            logger.info("Using cached DAM model")
            return cls._model, cls._processor

        logger.info("Loading DAM-3B-Video model for the first time...")
        model_path = cls._get_model_path()

        # Device detection
        if torch.cuda.is_available():
            device = "cuda"
            logger.info(f"Using CUDA device: {torch.cuda.get_device_name(0)}")
        elif torch.backends.mps.is_available():
            device = "mps"
            logger.info("Using MPS (Apple Silicon)")
        else:
            device = "cpu"
            logger.warning("No GPU detected, using CPU (will be slow)")

        # TODO: Implement actual DAM model loading
        # This will use the describe-anything library
        # from dam import DAMModel, DAMProcessor

        # For now, placeholder
        raise NotImplementedError("DAM model loading to be implemented")

        # cls._model = model
        # cls._processor = processor
        # return cls._model, cls._processor
```

**작업 내용**:
1. Singleton 패턴으로 모델 캐싱
2. ComfyUI 표준 디렉토리 구조 사용
3. 디바이스 자동 감지 (CUDA/MPS/CPU)
4. 에러 핸들링 및 로깅

**검증**:
- [ ] 파일 생성 확인
- [ ] import 에러 없음 확인
- [ ] 경로 해석 로직 테스트

### 2.2 DAM 모델 실제 로딩 로직 연구

**리서치 필요 사항**:
```python
# describe-anything 라이브러리 API 확인
# 1. 모델 클래스 이름
# 2. 프로세서 클래스 이름
# 3. 초기화 파라미터
# 4. from_pretrained 사용법

# 예상 코드 (확인 필요):
from dam import DAMModel, DAMProcessor  # 실제 import 경로 확인 필요

model = DAMModel.from_pretrained(
    "nvidia/DAM-3B-Video",
    cache_dir=str(model_path),
    device_map=device_map,
    torch_dtype=torch.float16
)

processor = DAMProcessor.from_pretrained(
    "nvidia/DAM-3B-Video",
    cache_dir=str(model_path)
)
```

**검증**:
- [ ] describe-anything 라이브러리 문서 확인
- [ ] 실제 API import 테스트
- [ ] 모델 로딩 성공 확인

---

## 🎨 Phase 3: DAM Inference 래퍼 구현 (1.5시간)

### 3.1 DAM Inference 클래스 생성

**파일**: `models/dam_inference.py`

```python
"""
DAM Inference Wrapper
Handles region-based video description with DAM-3B-Video
"""

import torch
import logging
from pathlib import Path
from typing import Union, List, Tuple, Optional

logger = logging.getLogger(__name__)


class DAMInference:
    """Wrapper for DAM-3B-Video inference"""

    def __init__(self, model, processor):
        self.model = model
        self.processor = processor
        self.device = model.device

    def generate_region_description(
        self,
        video_path: Union[str, Path],
        region_points: List[List[int]],
        prompt: str = "Describe what you see in the marked region.",
        max_new_tokens: int = 512,
        temperature: float = 0.2,
        top_p: float = 0.9,
        num_beams: int = 1
    ) -> str:
        """
        Generate description for specified region in video

        Args:
            video_path: Path to video file
            region_points: List of [x, y] coordinates marking region
                          e.g., [[100, 200]] for single point
                          e.g., [[100, 200], [300, 400]] for box
            prompt: Text prompt for description
            max_new_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            top_p: Top-p sampling
            num_beams: Number of beams for beam search

        Returns:
            Generated region description
        """
        logger.info(f"Generating region description for: {Path(video_path).name}")
        logger.info(f"Region points: {region_points}")

        try:
            # TODO: Implement actual DAM inference
            # Expected workflow:
            # 1. Load video
            # 2. Process region coordinates
            # 3. Apply focal prompt with region
            # 4. Generate description

            raise NotImplementedError("DAM inference to be implemented")

        except Exception as e:
            logger.error(f"Error during DAM inference: {e}")
            raise

    def generate_multi_region_description(
        self,
        video_path: Union[str, Path],
        regions: List[List[List[int]]],
        prompts: Optional[List[str]] = None,
        **kwargs
    ) -> List[str]:
        """
        Generate descriptions for multiple regions

        Args:
            video_path: Path to video file
            regions: List of region point lists
            prompts: Optional list of prompts (one per region)
            **kwargs: Additional generation parameters

        Returns:
            List of descriptions (one per region)
        """
        if prompts is None:
            prompts = ["Describe what you see in this region."] * len(regions)

        descriptions = []
        for region, prompt in zip(regions, prompts):
            desc = self.generate_region_description(
                video_path=video_path,
                region_points=region,
                prompt=prompt,
                **kwargs
            )
            descriptions.append(desc)

        return descriptions
```

**작업 내용**:
1. 단일 영역 설명 생성
2. 다중 영역 설명 생성 (배치)
3. 다양한 생성 파라미터 지원
4. 에러 핸들링

**검증**:
- [ ] 파일 생성 확인
- [ ] 클래스 구조 검토
- [ ] 파라미터 타입 힌팅 확인

### 3.2 Region 입력 형식 설계

**지원할 Region 형식**:
```python
# 1. Single Point (관심 지점)
region_points = [[x, y]]
# 예: [[100, 200]]

# 2. Bounding Box (사각형 영역)
region_points = [[x1, y1], [x2, y2]]
# 예: [[100, 200], [300, 400]]

# 3. Multiple Points (폴리곤)
region_points = [[x1, y1], [x2, y2], [x3, y3], ...]
# 예: [[100, 200], [200, 250], [150, 300]]
```

**ComfyUI 입력 처리**:
```python
# STRING 타입으로 JSON 입력 받기
region_input = "[[100, 200]]"  # 사용자 입력

# 파싱
import json
region_points = json.loads(region_input)

# 검증
if not isinstance(region_points, list):
    raise ValueError("Region points must be a list")
```

**검증**:
- [ ] JSON 파싱 로직 테스트
- [ ] 다양한 형식 입력 검증
- [ ] 에러 메시지 명확성 확인

---

## 🎭 Phase 4: ComfyUI 노드 구현 (2시간)

### 4.1 DAM 비디오 설명 노드 생성

**파일**: `video_nodes.py` (기존 파일에 추가)

```python
class VideoDescriptionDAM:
    """
    Video description node using NVIDIA DAM-3B-Video
    Generates detailed descriptions of specific regions in video
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "video_path": ("STRING", {
                    "default": "",
                    "multiline": False
                }),
                "region_points": ("STRING", {
                    "default": "[[100, 100]]",
                    "multiline": False,
                    "tooltip": "JSON format: [[x,y]] or [[x1,y1],[x2,y2]]"
                }),
                "analysis_type": (["detailed", "summary", "action"], {
                    "default": "detailed"
                }),
            },
            "optional": {
                "custom_prompt": ("STRING", {
                    "default": "",
                    "multiline": True
                }),
                "use_4bit": ("BOOLEAN", {
                    "default": False
                }),
                "temperature": ("FLOAT", {
                    "default": 0.2,
                    "min": 0.0,
                    "max": 1.0,
                    "step": 0.1
                }),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("description", "info")
    FUNCTION = "describe_region"
    CATEGORY = "video"

    @classmethod
    def _get_analysis_prompt(cls, analysis_type: str, custom_prompt: str = "") -> Tuple[str, int, float]:
        """Get optimized prompt for DAM analysis"""
        if custom_prompt and custom_prompt.strip():
            return (custom_prompt.strip(), 512, 0.2)

        analysis_configs = {
            "detailed": {
                "prompt": (
                    "Provide a comprehensive and detailed description of the marked region. "
                    "Include information about:\n"
                    "- Objects and subjects in the region\n"
                    "- Actions and movements\n"
                    "- Visual characteristics (colors, textures, lighting)\n"
                    "- Interactions with surroundings\n"
                    "- Temporal changes throughout the video"
                ),
                "max_tokens": 512,
                "temperature": 0.2
            },
            "summary": {
                "prompt": (
                    "Provide a brief summary of what happens in the marked region "
                    "in 2-3 sentences."
                ),
                "max_tokens": 256,
                "temperature": 0.2
            },
            "action": {
                "prompt": (
                    "Describe the specific actions and movements occurring in "
                    "the marked region."
                ),
                "max_tokens": 384,
                "temperature": 0.2
            }
        }

        config = analysis_configs.get(analysis_type, analysis_configs["detailed"])
        return (config["prompt"], config["max_tokens"], config["temperature"])

    def describe_region(self, video_path, region_points, analysis_type,
                       custom_prompt="", use_4bit=False, temperature=0.2):
        """
        Generate region-based video description using DAM

        Args:
            video_path: Path to video file
            region_points: JSON string of region coordinates
            analysis_type: Type of analysis (detailed/summary/action)
            custom_prompt: Optional custom prompt
            use_4bit: Use 4-bit quantization
            temperature: Sampling temperature

        Returns:
            Tuple of (description, info)
        """
        try:
            # Resolve video path
            video_path = video_path.strip()
            if not video_path:
                return ("Error: Video path is empty", "Please provide a video path")

            resolved_path = VideoDescriptionQwen3VL._resolve_video_path(video_path)

            # Parse region points
            import json
            try:
                points = json.loads(region_points)
                if not isinstance(points, list) or len(points) == 0:
                    return ("Error: Invalid region format", "Region must be non-empty list")
            except json.JSONDecodeError as e:
                return (f"Error: Invalid JSON format: {str(e)}", "Check region_points syntax")

            # Get analysis configuration
            prompt, max_tokens, config_temp = self._get_analysis_prompt(analysis_type, custom_prompt)
            if not custom_prompt:
                temperature = config_temp

            # Get video info
            from processing.video_processor import VideoProcessor
            video_info = VideoProcessor.get_video_info(resolved_path)
            video_source = Path(resolved_path).name

            info_text = (
                f"Source: {video_source}\n"
                f"Type: DAM Region Analysis ({analysis_type})\n"
                f"Region: {region_points}\n"
                f"Duration: {video_info['duration']:.2f}s\n"
                f"Resolution: {video_info['width']}x{video_info['height']}\n"
                f"Max tokens: {max_tokens}\n"
                f"Temperature: {temperature:.2f}\n"
                f"4-bit: {use_4bit}"
            )

            logger.info(f"Processing region-based video: {video_source}")
            logger.info(f"Analysis type: {analysis_type}")
            logger.info(f"Region points: {points}")

            # Load DAM model
            logger.info("Loading DAM-3B-Video model...")
            from models.dam_cache import DAMModelCache
            model, processor = DAMModelCache.get_dam_model(use_4bit=use_4bit)

            # Create inference wrapper
            from models.dam_inference import DAMInference
            inference = DAMInference(model, processor)

            # Generate description
            description = inference.generate_region_description(
                video_path=resolved_path,
                region_points=points,
                prompt=prompt,
                max_new_tokens=max_tokens,
                temperature=temperature
            )

            return (description, info_text)

        except Exception as e:
            error_msg = f"Error during DAM inference: {str(e)}"
            logger.error(error_msg)
            return (f"Error: {error_msg}", f"Exception: {type(e).__name__}")


# Add to NODE_CLASS_MAPPINGS
NODE_CLASS_MAPPINGS = {
    "VideoDescriptionQwen3VL": VideoDescriptionQwen3VL,
    "VideoDescriptionDAM": VideoDescriptionDAM,  # ← 추가
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "VideoDescriptionQwen3VL": "Video Description (Qwen3-VL)",
    "VideoDescriptionDAM": "Video Description (DAM Region)",  # ← 추가
}
```

**작업 내용**:
1. 독립적인 DAM 노드 클래스
2. Region 기반 입력 처리
3. 3가지 분석 타입 프리셋
4. Qwen3-VL 노드와 유사한 구조

**검증**:
- [ ] INPUT_TYPES 구조 확인
- [ ] Region 파싱 로직 테스트
- [ ] 에러 핸들링 검증

---

## 🧪 Phase 5: 테스트 및 검증 (1-1.5시간)

### 5.1 단위 테스트 스크립트 작성

**파일**: `test_dam.py`

```python
"""
Test DAM model integration
"""
import sys
import json
from pathlib import Path

current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def test_dam_region_description():
    """Test DAM region-based video description"""

    print("=" * 70)
    print("DAM Region Description Test")
    print("=" * 70)
    print()

    # Test video
    video_path = current_dir / "test.mp4"
    if not video_path.exists():
        print(f"⚠️ Test video not found: {video_path}")
        print("Please copy a test video to this directory")
        return

    # Test regions
    test_regions = [
        ([[100, 100]], "Single point - center focus"),
        ([[50, 50], [200, 200]], "Bounding box - top-left region"),
        ([[800, 500]], "Single point - right side"),
    ]

    print(f"Test video: {video_path}")
    print(f"Video size: {video_path.stat().st_size / 1024:.1f} KB")
    print()

    # Load model
    print("Loading DAM model...")
    try:
        from models.dam_cache import DAMModelCache
        from models.dam_inference import DAMInference

        model, processor = DAMModelCache.get_dam_model()
        inference = DAMInference(model, processor)
        print("✓ Model loaded successfully")
        print()
    except Exception as e:
        print(f"✗ Model loading failed: {e}")
        return

    # Test each region
    for region_points, description in test_regions:
        print("-" * 70)
        print(f"Test: {description}")
        print(f"Region: {region_points}")
        print()

        try:
            result = inference.generate_region_description(
                video_path=str(video_path),
                region_points=region_points,
                prompt="Describe what you see in the marked region.",
                max_new_tokens=256
            )

            print("Result:")
            print(result)
            print()
            print("✓ Test passed")

        except Exception as e:
            print(f"✗ Test failed: {e}")

        print()

    print("=" * 70)
    print("Test completed")
    print("=" * 70)

if __name__ == "__main__":
    test_dam_region_description()
```

**테스트 시나리오**:
1. 단일 포인트 region
2. 바운딩 박스 region
3. 다양한 위치 테스트

**검증**:
- [ ] 모델 로딩 성공
- [ ] Region 파싱 정상 작동
- [ ] 설명 생성 성공
- [ ] 각 region 타입별 테스트 통과

### 5.2 ComfyUI 통합 테스트

**테스트 절차**:
```bash
# 1. ComfyUI 재시작
cd /Volumes/KIMJUNGHO_SSD/ComfyUI
source .venv/bin/activate
python main.py

# 2. 브라우저에서 확인
# - 노드 메뉴에서 "video" 카테고리 확인
# - "Video Description (DAM Region)" 노드 존재 확인

# 3. 워크플로우 테스트
# - video_path: test.mp4
# - region_points: [[100, 100]]
# - analysis_type: detailed
# - 실행 및 결과 확인
```

**검증**:
- [ ] 노드가 UI에 나타남
- [ ] 파라미터 입력 정상
- [ ] 실행 시 에러 없음
- [ ] 결과 출력 확인

---

## 📚 Phase 6: 문서화 (30분)

### 6.1 USAGE.md 업데이트

**추가 섹션**:
```markdown
## 🎯 DAM Region-Based Analysis

### Video Description (DAM Region) Node

NVIDIA DAM-3B-Video 모델을 사용한 지역 기반 비디오 분석

#### Required Parameters
- `video_path`: 비디오 파일 경로
- `region_points`: 관심 영역 좌표 (JSON 형식)
  - Single point: `[[x, y]]`
  - Bounding box: `[[x1, y1], [x2, y2]]`
  - Polygon: `[[x1, y1], [x2, y2], [x3, y3], ...]`
- `analysis_type`: 분석 타입
  - `detailed`: 상세 설명
  - `summary`: 간단 요약
  - `action`: 행동 분석

#### Region 좌표 입력 가이드
...
```

### 6.2 README.md 업데이트

**Current Nodes 섹션에 추가**:
```markdown
### Video Description (DAM Region) - v1.0.0

**Status**: Experimental - Region-based video analysis

**Description**: Uses NVIDIA DAM-3B-Video for detailed descriptions
of user-specified regions within videos.

**Key Features**:
- Region-based analysis (points, boxes, polygons)
- High-detail localized descriptions
- Action-focused analysis option
...
```

---

## ✅ 최종 검증 체크리스트

### 코드 품질
- [ ] 모든 파일에 docstring 작성
- [ ] Type hints 적용
- [ ] 에러 핸들링 완비
- [ ] 로깅 메시지 적절

### 기능 검증
- [ ] DAM 모델 로딩 성공
- [ ] Region 파싱 정상 작동
- [ ] 3가지 분석 타입 모두 작동
- [ ] ComfyUI에서 노드 실행 성공

### 성능 검증
- [ ] 메모리 사용량 확인 (DAM 7GB)
- [ ] 추론 속도 측정 (벤치마크)
- [ ] GPU 활용률 확인

### 문서화
- [ ] USAGE.md 업데이트 완료
- [ ] README.md 업데이트 완료
- [ ] 예제 코드 포함
- [ ] 트러블슈팅 가이드 작성

---

## 🚀 구현 순서 요약

1. **환경 설정** (30분)
   - pip install describe-anything
   - 디렉토리 준비

2. **모델 로더** (1-1.5시간)
   - dam_cache.py 작성
   - 실제 API 연구 및 구현

3. **Inference 래퍼** (1.5시간)
   - dam_inference.py 작성
   - Region 처리 로직 구현

4. **ComfyUI 노드** (2시간)
   - VideoDescriptionDAM 클래스 작성
   - INPUT_TYPES 정의
   - 노드 등록

5. **테스트** (1-1.5시간)
   - 단위 테스트 작성 및 실행
   - ComfyUI 통합 테스트

6. **문서화** (30분)
   - USAGE.md, README.md 업데이트

**총 예상 시간**: 6-8시간

---

## ⚠️ 주의사항

1. **라이선스**: NVIDIA DAM은 비상업적 연구 라이선스
2. **메모리**: DAM(7GB) + Qwen3-VL(16GB) 동시 사용 시 23GB VRAM 필요
3. **Region 좌표**: 비디오 해상도에 맞는 절대 좌표 사용
4. **describe-anything API**: 공식 문서가 제한적이므로 코드 직접 확인 필요

---

## 📞 다음 단계 제안

구현 완료 후:
1. **듀얼 모델 노드** 개발 (Qwen3-VL + DAM 조합)
2. **SAM2 통합** (자동 region 감지)
3. **배치 처리** 지원
4. **시간 기반 region** 지원 (특정 프레임 범위)
