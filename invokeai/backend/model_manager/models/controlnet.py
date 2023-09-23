import os
from enum import Enum
from pathlib import Path
from typing import Literal, Optional

import torch

import invokeai.backend.util.logging as logger
from invokeai.app.services.config import InvokeAIAppConfig

from ..config import ControlNetCheckpointConfig, ControlNetDiffusersConfig
from .base import (
    GIG,
    BaseModelType,
    EmptyConfigLoader,
    InvalidModelException,
    ModelBase,
    ModelConfigBase,
    ModelNotFoundException,
    ModelType,
    SubModelType,
    calc_model_size_by_data,
    calc_model_size_by_fs,
    classproperty,
)


class ControlNetModelFormat(str, Enum):
    Checkpoint = "checkpoint"
    Diffusers = "diffusers"


class ControlNetModel(ModelBase):
    # model_class: Type
    # model_size: int

    class DiffusersConfig(ControlNetDiffusersConfig):
        model_format: Literal[ControlNetModelFormat.Diffusers] = ControlNetModelFormat.Diffusers

    class CheckpointConfig(ControlNetCheckpointConfig):
        model_format: Literal[ControlNetModelFormat.Checkpoint] = ControlNetModelFormat.Checkpoint

    def __init__(self, model_path: str, base_model: BaseModelType, model_type: ModelType):
        assert model_type == ModelType.ControlNet
        super().__init__(model_path, base_model, model_type)

        try:
            config = EmptyConfigLoader.load_config(self.model_path, config_name="config.json")
            # config = json.loads(os.path.join(self.model_path, "config.json"))
        except Exception:
            raise Exception("Invalid controlnet model! (config.json not found or invalid)")

        model_class_name = config.get("_class_name", None)
        if model_class_name not in {"ControlNetModel"}:
            raise Exception(f"Invalid ControlNet model! Unknown _class_name: {model_class_name}")

        try:
            self.model_class = self._hf_definition_to_type(["diffusers", model_class_name])
            self.model_size = calc_model_size_by_fs(self.model_path)
        except Exception:
            raise Exception("Invalid ControlNet model!")

    def get_size(self, child_type: Optional[SubModelType] = None):
        if child_type is not None:
            raise Exception("There is no child models in controlnet model")
        return self.model_size

    def get_model(
        self,
        torch_dtype: Optional[torch.dtype],
        child_type: Optional[SubModelType] = None,
    ):
        if child_type is not None:
            raise Exception("There are no child models in controlnet model")

        model = None
        for variant in ["fp16", None]:
            try:
                model = self.model_class.from_pretrained(
                    self.model_path,
                    torch_dtype=torch_dtype,
                    variant=variant,
                )
                break
            except Exception:
                pass
        if not model:
            raise ModelNotFoundException()

        # calc more accurate size
        self.model_size = calc_model_size_by_data(model)
        return model

    @classproperty
    def save_to_config(cls) -> bool:
        return False

    @classmethod
    def detect_format(cls, path: str):
        if not os.path.exists(path):
            raise ModelNotFoundException()

        if os.path.isdir(path):
            if os.path.exists(os.path.join(path, "config.json")):
                return ControlNetModelFormat.Diffusers

        if os.path.isfile(path):
            if any([path.endswith(f".{ext}") for ext in ["safetensors", "ckpt", "pt", "pth"]]):
                return ControlNetModelFormat.Checkpoint

        raise InvalidModelException(f"Not a valid model: {path}")

    @classmethod
    def convert_if_required(
        cls,
        model_config: ModelConfigBase,
        output_path: str,
    ) -> str:
        if isinstance(model_config, ControlNetCheckpointConfig):
            return _convert_controlnet_ckpt_and_cache(
                model_config=model_config,
                output_path=output_path,
            )
        else:
            return model_config.path


def _convert_controlnet_ckpt_and_cache(
    model_config: ControlNetCheckpointConfig,
    output_path: str,
    max_cache_size: int,
) -> str:
    """
    Convert the controlnet from checkpoint format to diffusers format,
    cache it to disk, and return Path to converted
    file. If already on disk then just returns Path.
    """
    app_config = InvokeAIAppConfig.get_config()
    weights = app_config.root_path / model_config.path
    output_path = Path(output_path)

    logger.info(f"Converting {weights} to diffusers format")
    # return cached version if it exists
    if output_path.exists():
        return output_path

    # make sufficient size in the cache folder
    size_needed = weights.stat().st_size
    max_cache_size = (app_config.conversion_cache_size * GIG,)
    trim_model_convert_cache(output_path.parent, max_cache_size - size_needed)

    # to avoid circular import errors
    from ..convert_ckpt_to_diffusers import convert_controlnet_to_diffusers

    convert_controlnet_to_diffusers(
        weights,
        output_path,
        original_config_file=app_config.root_path / model_config,
        image_size=512,
        scan_needed=True,
        from_safetensors=weights.suffix == ".safetensors",
    )
    return output_path
