"""
DAM Model Cache Manager
Singleton pattern for NVIDIA DAM-3B-Video model management
"""

import torch
import logging
from pathlib import Path
from typing import Optional, Tuple, Any

logger = logging.getLogger(__name__)


class DAMModelCache:
    """Singleton cache for DAM-3B-Video model"""

    _instance = None
    _tokenizer = None
    _model = None
    _image_processor = None
    _context_len = None

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
    def _detect_device(cls) -> Tuple[str, Optional[str]]:
        """
        Detect available device and appropriate device_map setting

        Returns:
            Tuple of (device, device_map)
        """
        if torch.cuda.is_available():
            device = "cuda"
            device_map = "auto"
            logger.info(f"Using CUDA device: {torch.cuda.get_device_name(0)}")
        elif torch.backends.mps.is_available():
            device = "mps"
            device_map = None  # MPS doesn't support device_map
            logger.info("Using MPS (Apple Silicon)")
        else:
            device = "cpu"
            device_map = None
            logger.warning("No GPU detected, using CPU (will be slow)")

        return device, device_map

    @classmethod
    def get_dam_model(cls, use_4bit: bool = False) -> Tuple[Any, Any, Any, int]:
        """
        Load and cache DAM-3B-Video model

        Args:
            use_4bit: Use 4-bit quantization (currently not supported for DAM)

        Returns:
            Tuple of (tokenizer, model, image_processor, context_len)
        """
        # Return cached model if available
        if cls._model is not None and cls._tokenizer is not None:
            logger.info("Using cached DAM model")
            return cls._tokenizer, cls._model, cls._image_processor, cls._context_len

        logger.info("Loading DAM-3B-Video model for the first time...")

        try:
            # Import DAM model class
            from dam.describe_anything_model import DescribeAnythingModel
            from transformers import AutoTokenizer, AutoProcessor
        except ImportError as e:
            raise ImportError(
                f"Failed to import DAM modules: {e}\n"
                "Please install describe-anything package:\n"
                "  pip install git+https://github.com/NVlabs/describe-anything.git"
            )

        model_path_str = "nvidia/DAM-3B-Video"
        cache_dir = cls._get_model_path()

        # Create cache directory if it doesn't exist
        cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Model cache directory: {cache_dir}")

        # Detect device
        device, device_map = cls._detect_device()

        # 4-bit quantization warning
        if use_4bit:
            logger.warning(
                "4-bit quantization is not officially supported for DAM models. "
                "Loading in FP16 instead."
            )

        try:
            # Initialize DescribeAnythingModel
            logger.info("Initializing DAM model...")

            # Prepare kwargs for model initialization
            model_kwargs = {
                "cache_dir": str(cache_dir),
                "device_map": device_map,
            }

            # For MPS/CPU, we need to disable device_map and use manual device placement
            if device_map is None:
                model_kwargs["device_map"] = None
                model_kwargs["torch_dtype"] = torch.float16

            model = DescribeAnythingModel(
                model_path=model_path_str,
                conv_mode="v1",  # Conversation mode
                prompt_mode="full+focal_crop",  # Format: crop_mode+crop_mode2
                **model_kwargs
            )

            # For MPS/CPU, manually move model to device after loading
            if device_map is None and hasattr(model, 'model'):
                logger.info(f"Moving model to {device}...")
                model.model = model.model.to(device)

            # Get tokenizer and image_processor from model
            tokenizer = getattr(model, 'tokenizer', None)
            image_processor = getattr(model, 'image_processor', None)

            if tokenizer is None:
                logger.warning("Tokenizer not found in model, loading manually...")
                tokenizer = AutoTokenizer.from_pretrained(
                    model_path_str,
                    cache_dir=str(cache_dir)
                )

            if image_processor is None:
                logger.warning("Image processor not found in model, using None")

            # Get context length from model
            context_len = getattr(model, 'context_len', 2048)

            logger.info(f"Model loaded successfully")
            logger.info(f"  Model type: {type(model).__name__}")
            logger.info(f"  Tokenizer type: {type(tokenizer).__name__}")
            logger.info(f"  Image processor type: {type(image_processor).__name__}")
            logger.info(f"  Context length: {context_len}")
            logger.info(f"  Device: {device}")

            # Cache the loaded components
            cls._tokenizer = tokenizer
            cls._model = model
            cls._image_processor = image_processor
            cls._context_len = context_len

            return tokenizer, model, image_processor, context_len

        except Exception as e:
            logger.error(f"Failed to load DAM model: {e}")
            raise RuntimeError(
                f"DAM model loading failed: {e}\n"
                "Ensure you have installed the describe-anything package and "
                "have sufficient disk space (~7GB) and memory."
            ) from e

    @classmethod
    def clear_cache(cls):
        """Clear cached model to free memory"""
        if cls._model is not None:
            logger.info("Clearing DAM model cache...")
            del cls._model
            del cls._tokenizer
            del cls._image_processor
            cls._model = None
            cls._tokenizer = None
            cls._image_processor = None
            cls._context_len = None

            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            logger.info("DAM model cache cleared")
