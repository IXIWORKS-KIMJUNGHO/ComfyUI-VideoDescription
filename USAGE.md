# ComfyUI Video Description - Usage Guide

## Node: Video Description (Qwen3-VL)

Generates detailed text descriptions of video content using the Qwen3-VL-8B-Instruct model.

---

## 📁 Video Path Input - Smart Resolution

The `video_path` parameter supports three input formats:

### 1. Just Filename (Recommended for ComfyUI workflow)
```
test.mp4
```
- Automatically searches in `ComfyUI/input/` directory
- Most convenient for typical ComfyUI usage
- Place your videos in the input folder

### 2. Relative Path with Subfolder
```
videos/test.mp4
my_project/scene1.mp4
```
- Searches relative to `ComfyUI/input/` directory
- Useful for organizing videos in subfolders
- Example: `ComfyUI/input/videos/test.mp4`

### 3. Absolute Path
```
/Volumes/KIMJUNGHO_SSD/videos/my_video.mp4
/Users/username/Desktop/test.mp4
```
- Direct path to video file anywhere on your system
- Useful for videos outside ComfyUI directory

---

## 🎬 Example Usage

### Scenario 1: Video in ComfyUI Input Folder
**File location**: `ComfyUI/input/demo.mp4`

**Input in node**:
```
video_path: demo.mp4
prompt: Describe this video in detail.
max_tokens: 128
fps: 1.0
```

### Scenario 2: Organized with Subfolders
**File location**: `ComfyUI/input/projects/scene1.mp4`

**Input in node**:
```
video_path: projects/scene1.mp4
prompt: What is happening in this scene?
max_tokens: 256
fps: 2.0
```

### Scenario 3: External Video File
**File location**: `/Users/myname/Downloads/video.mp4`

**Input in node**:
```
video_path: /Users/myname/Downloads/video.mp4
prompt: Summarize this video content.
max_tokens: 128
fps: 1.0
```

---

## ⚙️ Parameters

### Required Parameters

| Parameter | Type | Default | Options | Description |
|-----------|------|---------|---------|-------------|
| `video_path` | STRING | "" | - | Path to video file (see formats above) |
| `analysis_type` | DROPDOWN | "detailed" | detailed / summary / keywords | Type of video analysis |
| `fps` | FLOAT | 1.0 | 0.1-30.0 | Frames per second to sample from video |

### Optional Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `custom_prompt` | STRING | "" | - | Custom prompt (overrides analysis_type) |
| `use_4bit` | BOOLEAN | false | - | Use 4-bit quantization (saves VRAM) |
| `temperature` | FLOAT | 0.7 | 0.0-1.0 | Sampling temperature (only for custom_prompt) |

---

## 🎯 Analysis Types

### 1. Detailed Analysis (Default)
**Best for**: Comprehensive video understanding, content creation, detailed documentation

**Output format**: Full paragraph with rich description
- Main subjects and their actions
- Setting and environment details
- Notable objects and elements
- Temporal progression of events
- Visual style and mood

**Configuration**:
- Max tokens: 384 (ensures complete sentences)
- Temperature: 0.7 (balanced creativity)

**Example output**:
```
A sharply dressed man in a gray suit and red tie walks confidently down
a bustling city street, carrying a brown leather briefcase. The urban
environment features tall buildings and yellow taxis passing by in the
background. The scene has a professional, business-oriented atmosphere
with natural daylight creating dynamic shadows on the pavement.
```

---

### 2. Summary Analysis
**Best for**: Quick overview, thumbnails, video cataloging, brief descriptions

**Output format**: 2-3 concise sentences
- Focus on most important elements
- Main action only
- Brief and to the point

**Configuration**:
- Max tokens: 128 (enough for complete sentences)
- Temperature: 0.5 (more deterministic)

**Example output**:
```
A businessman in a suit walks down a city street carrying a briefcase.
Yellow taxis and other vehicles pass by in the background. The scene
takes place in an urban business district.
```

---

### 3. Keywords Analysis
**Best for**: Metadata extraction, searchability, structured data, tagging

**Output format**: Structured list format
- Main subjects
- Actions
- Setting
- Objects
- Mood/Style

**Configuration**:
- Max tokens: 256 (room for all categories)
- Temperature: 0.3 (very deterministic)

**Example output**:
```
- Main subjects: Businessman, pedestrian
- Actions: Walking, carrying briefcase, commuting
- Setting: Urban city street, business district, daytime
- Objects: Gray suit, red tie, brown briefcase, yellow taxis, buildings
- Mood/Style: Professional, dynamic, corporate, natural lighting
```

---

## 🎨 Custom Prompt

If you need specific analysis not covered by the presets, use `custom_prompt`:

**Example**:
```
custom_prompt: "What emotions or feelings does this video convey?"
```

When using custom prompt:
- Overrides the analysis_type preset
- Uses default max_tokens: 256
- Uses temperature from slider (default 0.7)

---

## 🎯 Tips for Best Results

### Choosing the Right Analysis Type

| Use Case | Recommended Type | Why |
|----------|------------------|-----|
| Video cataloging | `summary` | Quick, scannable descriptions |
| SEO/metadata | `keywords` | Structured, searchable data |
| Content description | `detailed` | Rich, engaging descriptions |
| Accessibility | `detailed` | Comprehensive for screen readers |
| Database tagging | `keywords` | Easy to parse and index |
| Social media | `summary` | Brief, attention-grabbing |

### FPS Sampling
- **Slow videos**: Use 0.5-1.0 FPS for talking heads, lectures
- **Fast action**: Use 2.0-5.0 FPS for sports, action scenes
- **Detailed analysis**: Higher FPS = more frames analyzed (slower but more detailed)

### Memory Optimization
- **Standard mode** (use_4bit=false): ~16GB VRAM required
- **4-bit mode** (use_4bit=true): ~8GB VRAM required
- Use 4-bit on systems with limited GPU memory

### Analysis Type + FPS Combinations

| Scenario | analysis_type | fps | Result |
|----------|---------------|-----|--------|
| Quick video preview | `summary` | 0.5 | Fast, brief overview |
| Detailed scene analysis | `detailed` | 2.0 | Comprehensive, captures action |
| Metadata tagging | `keywords` | 1.0 | Structured tags, balanced speed |
| Accessibility description | `detailed` | 1.0 | Rich description, reasonable speed |
| Batch processing | `summary` | 0.5 | Maximum throughput |

---

## 📊 Performance

Based on Apple Silicon (M-series) benchmarks:

| Video Length | Processing Time | Notes |
|--------------|-----------------|-------|
| 3 seconds | ~14 seconds | Model loading + inference |
| 30 seconds | ~130 seconds | Scales roughly linearly |
| 60 seconds | ~250 seconds | First load includes model caching |

**Note**: First run loads model into memory (5-6 seconds). Subsequent runs reuse cached model.

---

## ⚠️ Troubleshooting

### "Video file not found" Error
```
Error: Video file not found.
Searched: /Volumes/.../ComfyUI/input/video.mp4
Tip: Place videos in ComfyUI/input/ directory or provide absolute path
```

**Solutions**:
1. Check if file exists in `ComfyUI/input/` directory
2. Verify filename spelling (case-sensitive on Linux/Mac)
3. Use absolute path if file is outside ComfyUI directory

### "Invalid video file" Error
```
Error: Invalid video file: /path/to/file.mp4
```

**Solutions**:
1. Verify file is a valid video format (MP4, AVI, MOV, etc.)
2. Check if file is corrupted (try playing in media player)
3. Ensure OpenCV can read the format

### Slow Processing
- **Expected**: Video description is compute-intensive
- **3-second video**: Takes ~14 seconds (10x slower than realtime)
- **Optimization**: Use lower FPS sampling (e.g., 0.5 instead of 2.0)

---

## 📝 Output Format

The node returns two outputs:

### 1. Description (STRING)
The generated text description of the video content.

**Example**:
```
A sharply dressed man in a gray suit and red tie walks confidently down
a bustling city street, carrying a brown leather briefcase as yellow
taxis and other vehicles blur past in the background.
```

### 2. Info (STRING)
Metadata about the processing.

**Example**:
```
Source: test.mp4
Path: test.mp4
Duration: 3.00s
Resolution: 1920x1080
FPS: 30.00
Sampling: 1.0 FPS
4-bit: False
```

---

## 🔄 Workflow Integration

### Simple Workflow
```
[Video Description (Qwen3-VL)]
    ↓ description
[Display Text / Save Text]
```

### Advanced Workflow
```
[Video Description (Qwen3-VL)]
    ↓ description
[Text Processing / Prompt Builder]
    ↓
[Image Generation with Video Context]
```

---

## 📚 Supported Video Formats

Supported by OpenCV and FFmpeg:
- MP4 (H.264, H.265)
- AVI
- MOV
- MKV
- WebM
- FLV

---

## 🆘 Support

If you encounter issues:
1. Check ComfyUI console for detailed error messages
2. Verify video file is accessible and not corrupted
3. Ensure sufficient system memory (16GB+ recommended)
4. Check model files are downloaded in `ComfyUI/models/video_description/`

---

## 📖 Model Information

**Model**: Qwen3-VL-8B-Instruct
**Source**: https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct
**License**: Apache 2.0
**Purpose**: Vision-language model for image and video understanding

**Model Location**: `ComfyUI/models/video_description/Qwen3-VL-8B-Instruct/`
