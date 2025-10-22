# ComfyUI-VideoDescription

Video description custom nodes for ComfyUI powered by advanced vision-language models.

## Features

- 🎥 **Full Video Analysis** with Qwen3-VL-8B-Instruct
- 🎯 **Region-Based Analysis** with NVIDIA DAM-3B-Video
- ⚡ Optimized inference with model caching
- 📊 Multiple analysis types (detailed, summary, keywords/action)
- 🚀 Smart path resolution for easy video loading
- 🔧 Easy integration with ComfyUI workflows

## Installation

### Method 1: Git Clone (Recommended)

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/IXIWORKS-KIMJUNGHO/ComfyUI-VideoDescription.git
cd ComfyUI-VideoDescription

# Install ONLY the required packages
# (ComfyUI already has torch, transformers, numpy, etc.)
pip install qwen-vl-utils opencv-python

# Optional: For DAM support (CUDA only)
# pip install git+https://github.com/NVlabs/describe-anything.git
```

⚠️ **IMPORTANT**: Do NOT run `pip install -r requirements.txt` directly!
This will conflict with ComfyUI's existing packages. Install only the specific packages listed above.

### Method 2: Manual Installation

1. Download this repository
2. Extract to `ComfyUI/custom_nodes/ComfyUI-VideoDescription`
3. Install **only required** dependencies:

```bash
cd ComfyUI/custom_nodes/ComfyUI-VideoDescription

# Install only what ComfyUI doesn't have
pip install qwen-vl-utils opencv-python

# Optional: For DAM (CUDA only)
# pip install git+https://github.com/NVlabs/describe-anything.git
```

## Model Download

**Important**: You need to download the models before using these nodes.

### Model Locations

Models will be downloaded to:
```
ComfyUI/models/video_description/
├── Qwen3-VL-8B-Instruct/    # Full video analysis model
└── DAM-3B-Video/             # Region-based analysis model
```

This follows ComfyUI's standard model organization structure.

### Option 1: Pre-download (Recommended)

Download the models before first use to avoid waiting:

```bash
cd ComfyUI/custom_nodes/ComfyUI-VideoDescription
python download_models.py
```

This will download models to `ComfyUI/models/video_description/`

### Option 2: Automatic Download

Models will download automatically on first use. However, this will cause delays:
- **Qwen3-VL**: 10-30 minute delay (16GB download)
- **DAM**: 5-15 minute delay (7GB download)

**Download behavior**:
1. Node checks model directory
2. If not found: Downloads from Hugging Face
3. If found: Loads directly (fast!)

### Disk Space Requirements

- **Qwen3-VL-8B (FP16)**: ~16GB
- **DAM-3B-Video (FP16)**: ~7GB (**CUDA only**)
- **With 4-bit quantization**: ~12GB total
- **Recommended free space**: 30GB+ (for both models)

### Hardware Requirements

**Qwen3-VL Node:**
- ✅ Works on: NVIDIA CUDA, Apple Silicon (MPS), CPU
- Recommended: 16GB+ RAM, GPU with 8GB+ VRAM

**DAM Node:**
- ⚠️ **CUDA ONLY**: Requires NVIDIA GPU with CUDA support
- ❌ Does NOT work on: Mac (MPS), CPU-only, AMD GPUs
- Recommended: NVIDIA GPU with 8GB+ VRAM, Linux/Windows OS

## Quick Start

### Usage Example

1. **Place your video in ComfyUI/input/ directory** (Recommended)
   ```bash
   # Example: Copy video to input folder
   cp my_video.mp4 ComfyUI/input/
   ```

2. **Add the node in ComfyUI**
   - Look for "video" category in the node menu
   - Add "Video Description (Qwen3-VL)" node

3. **Configure the node**
   - `video_path`: Enter just the filename (e.g., `my_video.mp4`)
     - The node automatically searches in `ComfyUI/input/` directory
     - Supports subfolders: `videos/my_video.mp4`
     - Or use absolute path: `/full/path/to/video.mp4`
   - Set your prompt and parameters
   - Run to generate description

### Testing the Node

1. Restart ComfyUI
2. Copy a test video to `ComfyUI/input/`
3. Add "Video Description (Qwen3-VL)" node
4. Enter the video filename in `video_path` (e.g., `test.mp4`)
5. Run the workflow

## Current Nodes

### Video Description (Qwen3-VL) - v1.2.0

**Status**: Fully functional with smart path resolution and analysis type presets

**Required Inputs**:
- `video_path` (STRING): Path to video file
  - **Just filename**: `video.mp4` → searches in `ComfyUI/input/`
  - **Subfolder**: `videos/scene1.mp4` → searches in `ComfyUI/input/videos/`
  - **Absolute path**: `/full/path/to/video.mp4`
- `analysis_type` (DROPDOWN): Type of video analysis
  - **detailed**: Comprehensive description with rich details (384 tokens, temp 0.7)
  - **summary**: Brief 2-3 sentence overview (128 tokens, temp 0.5)
  - **keywords**: Structured metadata extraction (256 tokens, temp 0.3)
  - Default: "detailed"
- `fps` (FLOAT): Frames per second for video sampling
  - Default: 1.0, Min: 0.1, Max: 30.0
  - Higher FPS = more frames analyzed = slower but more detailed
  - Recommended: 0.5-1.0 for most videos

**Optional Inputs**:
- `custom_prompt` (STRING): Custom analysis prompt
  - Overrides the analysis_type preset
  - Use when you need specific questions answered
  - Default: "" (uses analysis_type preset)
- `use_4bit` (BOOLEAN): Enable 4-bit quantization
  - Default: False
  - Reduces VRAM usage from ~16GB to ~8GB
- `temperature` (FLOAT): Text generation creativity (LLM parameter)
  - Default: 0.7, Min: 0.0, Max: 1.0
  - Only used when custom_prompt is provided
  - **Note**: This is NOT the same as "denoise" in image generation

**Outputs**:
- `description` (STRING): Generated video description
- `info` (STRING): Processing information (duration, resolution, FPS, etc.)

**How It Works**:
1. Resolves video path (searches in ComfyUI/input/ if relative)
2. Validates video file format and accessibility
3. Loads Qwen3-VL model (cached after first load)
4. Extracts frames at specified FPS rate
5. Generates natural language description using Vision-Language Model
6. Returns description and metadata

**Performance**:
- 3-second video: ~14 seconds (model loading + inference)
- 30-second video: ~130 seconds
- First run includes model loading (5-6 seconds), subsequent runs reuse cached model

---

### Video Description (DAM Region) - v1.0.0

**Status**: Fully functional - Region-based video analysis (**CUDA Required**)

**Description**: Uses NVIDIA DAM-3B-Video for detailed descriptions of user-specified regions within videos.

⚠️ **IMPORTANT**: This node requires NVIDIA CUDA GPU. It does NOT work on:
- Mac (Apple Silicon MPS)
- CPU-only systems
- AMD GPUs

Use this node only on Linux/Windows systems with NVIDIA CUDA GPUs.

**Required Inputs**:
- `video_path` (STRING): Path to video file (same as Qwen3-VL)
- `region_points` (STRING): JSON array of region coordinates
  - **Single point**: `[[100, 100]]` - Creates circular mask around point
  - **Bounding box**: `[[x1, y1], [x2, y2]]` - Rectangular region
  - **Polygon**: `[[x1, y1], [x2, y2], [x3, y3], ...]` - Custom polygon shape
- `analysis_type` (DROPDOWN): Type of region analysis
  - **detailed**: Comprehensive region description (512 tokens, temp 0.2)
  - **summary**: Brief 2-3 sentence summary (256 tokens, temp 0.2)
  - **action**: Focus on actions/movements (384 tokens, temp 0.2)

**Optional Inputs**:
- `custom_prompt` (STRING): Custom analysis prompt
- `max_frames` (INT): Maximum frames to process (default: 8, range: 1-32)
- `use_4bit` (BOOLEAN): Enable 4-bit quantization (default: False)
- `temperature` (FLOAT): Sampling temperature (default: 0.2)

**Outputs**:
- `description` (STRING): Region-specific description
- `info` (STRING): Processing metadata

**How It Works**:
1. Resolves video path and validates file
2. Parses region coordinates from JSON
3. Loads DAM-3B-Video model (cached after first load)
4. Samples frames uniformly across video
5. Creates binary mask from region points
6. Generates localized description focusing on marked region
7. Returns region-specific analysis

**Use Cases**:
- Track specific objects/people through video
- Analyze actions in defined areas
- Focus on region of interest while ignoring background
- Multi-region analysis (run node multiple times)

**Example Regions**:
```json
// Center point
[[960, 540]]

// Top-left quadrant
[[0, 0], [960, 540]]

// Custom polygon (triangle)
[[100, 100], [500, 100], [300, 400]]
```

**Performance**:
- Model size: ~7GB
- Inference time: ~10-20 seconds (8 frames)
- Works independently from Qwen3-VL node

---

## Roadmap

### Phase 1: Qwen3-VL Integration ✅
- ✅ Model loader implementation with caching
- ✅ Video validation and info extraction
- ✅ Inference pipeline with Qwen3-VL
- ✅ Error handling and cleanup
- ✅ Smart path resolution with ComfyUI/input/ search
- ✅ Performance optimization (removed tensor conversion overhead)
- ✅ Analysis type presets (detailed/summary/keywords)

### Phase 2: DAM Region Analysis ✅
- ✅ DAM model loader with singleton caching
- ✅ Region-based inference wrapper
- ✅ ComfyUI node integration
- ✅ Region mask generation (point/box/polygon)
- ✅ Multi-frame video processing
- ✅ Analysis type presets (detailed/summary/action)

### Phase 3: Advanced Features (Planned)
- [ ] Dual-model combination node (Qwen3-VL + DAM)
- [ ] SAM2 integration for automatic region detection
- [ ] Batch processing support
- [ ] Time-based region tracking
- [ ] Performance optimization

### Phase 4: Production Ready (Future)
- [ ] Comprehensive testing
- [ ] Example workflows
- [ ] Performance benchmarks
- [ ] Community deployment

## Requirements

- Python 3.8+
- PyTorch 2.0+
- NVIDIA GPU with 16GB+ VRAM (recommended)
- ComfyUI

## Dependencies

See [requirements.txt](requirements.txt) for full list:
- torch>=2.0.0
- transformers>=4.50.0
- accelerate>=0.20.0
- qwen-vl-utils
- opencv-python
- pillow
- numpy

## Hardware Recommendations

| Configuration | GPU | VRAM | Performance |
|--------------|-----|------|-------------|
| Minimum | RTX 3060 | 12GB | Basic (with quantization) |
| Recommended | RTX 4090 | 24GB | Good (FP16) |
| Optimal | A100 | 40GB+ | Excellent (FP16, batch) |

## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## Support

- **GitHub Issues**: Report bugs or request features
- **Documentation**: Check README and code comments

## Acknowledgments

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) - Node-based UI for Stable Diffusion
- [Qwen-VL](https://github.com/QwenLM/Qwen-VL) - Vision-language model by Alibaba
- [NVIDIA DAM](https://huggingface.co/nvidia/DAM-3B-Video) - Description Anything Model

## Changelog

### v1.2.0 (2025-10-22)
- ✅ Analysis type presets: detailed / summary / keywords
- ✅ Optimized prompts and parameters for each analysis type
- ✅ Custom prompt support with override capability
- ✅ Automatic max_tokens and temperature configuration per type
- ✅ Enhanced USAGE.md with analysis type examples

### v1.1.0 (2025-10-22)
- ✅ Smart video path resolution (auto-search in ComfyUI/input/)
- ✅ Performance optimization: removed tensor conversion (13x faster)
- ✅ Simplified to path-only input (cleaner architecture)
- ✅ Updated documentation with temperature vs denoise explanation
- ✅ Added comprehensive usage guide (USAGE.md)

### v1.0.0 (2025-10-22)
- ✅ Full Qwen3-VL integration
- ✅ Model caching with singleton pattern
- ✅ 4-bit quantization support
- ✅ ComfyUI standard model directory structure
- ✅ Comprehensive error handling

### v0.1.0-alpha (2025-10-21)
- Initial project structure
- Basic node skeleton
- Node registration system
- Documentation framework
