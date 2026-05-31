"""
NitroGenerator
==============
Builds a .nitro asset bundle from uploaded PNG/GIF images.

The .nitro format used by NitroTS (nitro-renderer) is a ZIP archive
containing the following files:

  manifest.json   – asset manifest describing sprites and visualizations
  *.png           – individual sprite images for each rotation / state

The manifest follows the structure expected by the @nitrots/nitro-renderer
AssetManager when it loads furniture bundles.
"""

from __future__ import annotations

import io
import json
import logging
import os
import zipfile
from typing import Dict, List, Optional

from PIL import Image, ImageSequence

logger = logging.getLogger(__name__)

# NitroTS rotation indices (Habbo isometric: 0/2/4/6 + diagonals 1/3/5/7)
ALL_ROTATIONS = [0, 1, 2, 3, 4, 5, 6, 7]

# Color codes used in the manifest visualization layer
DEFAULT_COLOR = "16777215"  # white


class NitroGenerator:
    """Generate a .nitro bundle from raw images."""

    def __init__(
        self,
        item_name: str,
        sprite_id: int,
        job: dict,
        upload_dir: str,
        images_meta: dict,
    ):
        self.item_name = item_name
        self.sprite_id = sprite_id
        self.job = job
        self.upload_dir = upload_dir
        self.images_meta = images_meta  # {rotation_key: filename}

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def build_nitro(self) -> bytes:
        """Return the .nitro ZIP bundle as raw bytes."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            sprites, sprite_entries = self._collect_sprites()
            manifest = self._build_manifest(sprite_entries)
            zf.writestr("manifest.json", json.dumps(manifest, separators=(",", ":")))
            for name, data in sprites.items():
                zf.writestr(name, data)
        return buf.getvalue()

    # ------------------------------------------------------------------
    # Sprite collection
    # ------------------------------------------------------------------

    def _collect_sprites(self):
        """
        Load uploaded images and return:
          sprites      – {filename: bytes}  images to embed in the ZIP
          sprite_entries – list of sprite dicts for the manifest
        """
        sprites: Dict[str, bytes] = {}
        sprite_entries: List[dict] = []

        for rotation_key, rel_path in self.images_meta.items():
            # Security: reject absolute paths and paths that escape the upload directory
            norm = os.path.normpath(rel_path)
            if os.path.isabs(norm) or norm.startswith(".."):
                logger.warning("Skipping unsafe image path: %s (rotation=%s)", rel_path, rotation_key)
                continue
            abs_path = os.path.join(self.upload_dir, norm)
            if not os.path.exists(abs_path):
                logger.warning("Image not found: %s (rotation=%s)", abs_path, rotation_key)
                continue

            frames = self._load_frames(abs_path)
            for frame_index, frame_bytes in enumerate(frames):
                sprite_name = self._sprite_name(rotation_key, frame_index)
                img_filename = f"{sprite_name}.png"
                sprites[img_filename] = frame_bytes
                w, h = self._image_size(frame_bytes)
                sprite_entries.append({
                    "name": sprite_name,
                    "fileName": img_filename,
                    "x": 0,
                    "y": 0,
                    "width": w,
                    "height": h,
                    "flipH": False,
                })

        if not sprite_entries:
            # Fallback: create a placeholder 64×64 white sprite
            placeholder = self._placeholder_image(64, 64)
            sprite_name = f"{self.item_name}_0_0_0"
            sprites[f"{sprite_name}.png"] = placeholder
            sprite_entries.append({
                "name": sprite_name,
                "fileName": f"{sprite_name}.png",
                "x": 0,
                "y": 0,
                "width": 64,
                "height": 64,
                "flipH": False,
            })

        return sprites, sprite_entries

    def _load_frames(self, path: str) -> List[bytes]:
        """Return PNG bytes for every frame of an image (GIF = multiple frames)."""
        frames: List[bytes] = []
        try:
            with Image.open(path) as img:
                for frame in ImageSequence.Iterator(img):
                    frame = frame.convert("RGBA")
                    buf = io.BytesIO()
                    frame.save(buf, format="PNG")
                    frames.append(buf.getvalue())
        except Exception as exc:
            logger.warning("Failed to load image %s: %s", path, exc)
        return frames or []

    def _image_size(self, png_bytes: bytes):
        with Image.open(io.BytesIO(png_bytes)) as img:
            return img.size  # (width, height)

    @staticmethod
    def _placeholder_image(w: int, h: int) -> bytes:
        img = Image.new("RGBA", (w, h), (200, 200, 200, 128))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def _sprite_name(self, rotation_key: str, frame_index: int) -> str:
        """Build the sprite asset name following Habbo naming conventions.

        Expected format: {item_name}_{size}_{rotation}_{frame}
        e.g.  custom_chair_64_2_0

        rotation_key comes from the form field name ("rotation_2") or
        state field ("state_0") – we extract just the numeric part.
        """
        rot_num = rotation_key.replace("rotation_", "").replace("state_", "")
        return f"{self.item_name}_64_{rot_num}_{frame_index}"

    # ------------------------------------------------------------------
    # Manifest building
    # ------------------------------------------------------------------

    def _build_manifest(self, sprite_entries: List[dict]) -> dict:
        """Build the NitroTS asset manifest JSON."""

        # Determine which rotations have sprites
        rotations_used: List[int] = []
        for entry in sprite_entries:
            name = entry["name"]
            # name pattern: {item_name}_64_{rotation}_{frame}
            parts = name.rsplit("_", 2)
            if len(parts) >= 3:
                try:
                    rot = int(parts[-2])
                    if rot not in rotations_used:
                        rotations_used.append(rot)
                except ValueError:
                    pass
        if not rotations_used:
            rotations_used = [0]

        interaction_modes = max(1, self.job.get("interaction_modes_count", 1))

        # Build directions list for visualization
        directions = []
        for rot in sorted(rotations_used):
            directions.append({"id": rot})

        # Build animation entries (one per interaction state)
        animations: Dict[str, dict] = {}
        for state in range(interaction_modes):
            state_id = str(state)
            # Collect frame names for this state / all rotations
            anim_layers: Dict[str, dict] = {}
            for rot in rotations_used:
                layer_id = str(rot)
                frame_sequence: List[dict] = []
                frame_idx = 0
                while True:
                    candidate = f"{self.item_name}_64_{rot}_{frame_idx}"
                    if any(e["name"] == candidate for e in sprite_entries):
                        frame_sequence.append({"id": frame_idx})
                        frame_idx += 1
                    else:
                        break
                if frame_sequence:
                    anim_layers[layer_id] = {"frameSequence": frame_sequence}
            if anim_layers:
                animations[state_id] = {"layers": anim_layers}

        # Visualization layer uses the first rotation sprite dimensions
        layer_w = sprite_entries[0]["width"] if sprite_entries else 64
        layer_h = sprite_entries[0]["height"] if sprite_entries else 64

        visualization = {
            "type": "furniture",
            "size": 64,
            "layerCount": len(rotations_used),
            "angle": 45,
            "directions": directions,
            "layers": {
                str(i): {
                    "id": i,
                    "z": 0,
                    "color": DEFAULT_COLOR,
                    "alpha": 255,
                    "ink": "NONE",
                    "ignoreMouse": False,
                }
                for i in range(len(rotations_used))
            },
            "colors": {
                "1": {"layers": {"0": {"color": DEFAULT_COLOR}}}
            },
            "animations": animations,
        }

        return {
            "name": self.item_name,
            "spriteId": self.sprite_id,
            "assets": {e["name"]: e for e in sprite_entries},
            "visualizations": [visualization],
            "logic": {
                "type": "furniture",
                "model": {
                    "dimensions": {
                        "x": self.job.get("width", 1),
                        "y": self.job.get("length", 1),
                        "z": float(self.job.get("stack_height", 1.0)),
                    },
                    "directions": [{"id": r} for r in sorted(rotations_used)],
                },
            },
        }
