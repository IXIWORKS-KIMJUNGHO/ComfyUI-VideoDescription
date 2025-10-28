"""
DAM Inference Wrapper
Handles region-based video description with NVIDIA DAM-3B-Video
"""

import torch
import logging
import json
from pathlib import Path
from typing import Union, List, Optional, Any
import cv2
import numpy as np

logger = logging.getLogger(__name__)


class DAMInference:
    """Wrapper for DAM-3B-Video inference with region-based analysis"""

    def __init__(self, tokenizer, model, image_processor, context_len):
        """
        Initialize DAM inference wrapper

        Args:
            tokenizer: DAM tokenizer
            model: DAM model (DescribeAnythingModel instance)
            image_processor: DAM image processor
            context_len: Context length
        """
        self.tokenizer = tokenizer
        self.model = model
        self.image_processor = image_processor
        self.context_len = context_len
        # For DescribeAnythingModel, device is stored as attribute
        self.device = getattr(model, 'device', 'cuda' if torch.cuda.is_available() else 'cpu')

    def _create_region_mask(
        self,
        image_shape: tuple,
        region_points: List[List[int]]
    ) -> np.ndarray:
        """
        Create binary mask from region points

        Args:
            image_shape: (height, width, channels)
            region_points: List of [x, y] coordinates

        Returns:
            Binary mask as numpy array (H, W)
        """
        height, width = image_shape[:2]
        mask = np.zeros((height, width), dtype=np.uint8)

        points_array = np.array(region_points, dtype=np.int32)

        if len(region_points) == 1:
            # Single point - create small circular mask
            x, y = region_points[0]
            cv2.circle(mask, (x, y), radius=50, color=255, thickness=-1)

        elif len(region_points) == 2:
            # Bounding box - two points define top-left and bottom-right
            x1, y1 = region_points[0]
            x2, y2 = region_points[1]
            cv2.rectangle(mask, (x1, y1), (x2, y2), color=255, thickness=-1)

        else:
            # Polygon - fill polygon defined by multiple points
            cv2.fillPoly(mask, [points_array], color=255)

        return mask

    def _load_video_frames(
        self,
        video_path: Union[str, Path],
        max_frames: int = 8
    ) -> List[np.ndarray]:
        """
        Load frames from video file

        Args:
            video_path: Path to video file
            max_frames: Maximum number of frames to extract

        Returns:
            List of frame arrays (RGB format)
        """
        cap = cv2.VideoCapture(str(video_path))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Sample frames uniformly across video
        frame_indices = np.linspace(0, total_frames - 1, max_frames, dtype=int)

        frames = []
        for idx in frame_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append(frame_rgb)

        cap.release()

        if not frames:
            raise ValueError(f"No frames could be extracted from {video_path}")

        logger.info(f"Loaded {len(frames)} frames from video")
        return frames

    def generate_region_description(
        self,
        video_path: Union[str, Path],
        region_points: Optional[List[List[int]]] = None,
        prompt: str = "Describe what you see in the video.",
        max_new_tokens: int = 512,
        temperature: float = 0.2,
        top_p: float = 0.9,
        num_beams: int = 1,
        max_frames: int = 8
    ) -> str:
        """
        Generate description for video (full frame or specified region)

        Args:
            video_path: Path to video file
            region_points: Optional list of [x, y] coordinates marking region
                          - None: Analyze entire video frame (full-frame mask)
                          - Single point: [[x, y]]
                          - Bounding box: [[x1, y1], [x2, y2]]
                          - Polygon: [[x1, y1], [x2, y2], [x3, y3], ...]
            prompt: Text prompt for description
            max_new_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0-1.0)
            top_p: Top-p sampling (0.0-1.0)
            num_beams: Number of beams for beam search
            max_frames: Maximum frames to process from video

        Returns:
            Generated video description
        """
        analysis_type = "full video" if region_points is None else "region"
        logger.info(f"Generating {analysis_type} description for: {Path(video_path).name}")
        if region_points:
            logger.info(f"Region points: {region_points}")
        logger.info(f"Max frames: {max_frames}")

        try:
            # Load video frames
            frames = self._load_video_frames(video_path, max_frames=max_frames)

            # Create region mask from first frame
            # If region_points is None, create full-frame mask (all white)
            if region_points is None:
                height, width = frames[0].shape[:2]
                mask = np.ones((height, width), dtype=np.uint8) * 255
                logger.info(f"Using full-frame mask: {width}x{height}")
            else:
                mask = self._create_region_mask(frames[0].shape, region_points)

            # DescribeAnythingModel uses get_description method
            # It expects: image/video path or frames, mask, and prompt
            logger.info("Generating description using DAM...")

            # For video: use first frame for now (DAM processes video internally if supported)
            # Convert frames to proper format
            import PIL.Image as Image

            # Use first frame as primary image
            first_frame_rgb = frames[0]
            pil_image = Image.fromarray(first_frame_rgb)

            # Convert mask to PIL Image
            pil_mask = Image.fromarray(mask)

            # DAM expects query to contain <image> tag
            # The tag is replaced internally with image tokens
            if "<image>" not in prompt:
                query_with_image = f"<image>\n{prompt}"
            else:
                query_with_image = prompt

            # Call DAM's get_description method
            # Signature: get_description(self, image_pil, mask_pil, query, ...)
            description = self.model.get_description(
                image_pil=pil_image,
                mask_pil=pil_mask,
                query=query_with_image,
                temperature=temperature,
                top_p=top_p,
                num_beams=num_beams,
                max_new_tokens=max_new_tokens
            )

            logger.info(f"Generated description ({len(description)} chars)")
            return description

        except Exception as e:
            logger.error(f"Error during DAM inference: {e}")
            import traceback
            traceback.print_exc()
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

        if len(prompts) != len(regions):
            raise ValueError(
                f"Number of prompts ({len(prompts)}) must match "
                f"number of regions ({len(regions)})"
            )

        descriptions = []
        for idx, (region, prompt) in enumerate(zip(regions, prompts)):
            logger.info(f"Processing region {idx + 1}/{len(regions)}")
            desc = self.generate_region_description(
                video_path=video_path,
                region_points=region,
                prompt=prompt,
                **kwargs
            )
            descriptions.append(desc)

        return descriptions
