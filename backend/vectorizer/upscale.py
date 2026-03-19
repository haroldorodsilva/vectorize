"""
Super-resolution upscaling using Real-ESRGAN.
Upscales images 2x or 4x before vectorization for better detail.
Falls back to Pillow bicubic if Real-ESRGAN is not installed.
"""
import io
import numpy as np
import cv2
from PIL import Image


def upscale_image(image_bytes: bytes, scale: int = 2) -> bytes:
    """
    Upscale image by given factor (2 or 4).
    Uses Real-ESRGAN if available, falls back to Pillow bicubic.
    Returns PNG bytes.
    """
    if scale not in (2, 4):
        scale = 2

    try:
        return _upscale_realesrgan(image_bytes, scale)
    except ImportError:
        return _upscale_pillow(image_bytes, scale)


def _upscale_realesrgan(image_bytes: bytes, scale: int) -> bytes:
    """Upscale using Real-ESRGAN (requires realesrgan package)."""
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet

    # Decode image
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    # Initialize model
    if scale == 4:
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                        num_block=23, num_grow_ch=32, scale=4)
        model_name = "RealESRGAN_x4plus"
    else:
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                        num_block=23, num_grow_ch=32, scale=2)
        model_name = "RealESRGAN_x2plus"

    upsampler = RealESRGANer(
        scale=scale,
        model_path=None,  # Auto-download
        model=model,
        tile=0,
        tile_pad=10,
        pre_pad=0,
        half=False,
    )

    output, _ = upsampler.enhance(img, outscale=scale)

    # Encode to PNG
    _, buf = cv2.imencode('.png', output)
    return buf.tobytes()


def _upscale_pillow(image_bytes: bytes, scale: int) -> bytes:
    """Fallback: upscale using Pillow bicubic interpolation."""
    img = Image.open(io.BytesIO(image_bytes))
    new_w = img.width * scale
    new_h = img.height * scale
    resized = img.resize((new_w, new_h), Image.BICUBIC)

    buf = io.BytesIO()
    resized.save(buf, format="PNG")
    return buf.getvalue()
