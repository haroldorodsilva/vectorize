"""
Background removal using rembg (U2-Net model).
Returns PNG bytes with transparent background.
"""
import io
from PIL import Image


def remove_background(image_bytes: bytes) -> bytes:
    """Remove background from image. Returns PNG with transparency."""
    from rembg import remove

    input_img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    output_img = remove(input_img)

    buf = io.BytesIO()
    output_img.save(buf, format="PNG")
    return buf.getvalue()
