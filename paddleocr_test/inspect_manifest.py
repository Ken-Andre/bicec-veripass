import json
import os
from pathlib import Path

images_dir = Path(r"c:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\paddleocr_test\notebooks\output\images")
files = sorted([f.name for f in images_dir.glob("*.jpg")])
print(f"Total image files: {len(files)}")
print(f"First 10 images: {files[:10]}")
print(f"Last 10 images: {files[-10:]}")

manifest_path = Path(r"c:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\paddleocr_test\notebooks\output\dataset_manifest.json")
with open(manifest_path, "r", encoding="utf-8") as f:
    data = json.load(f)

manifest_ids = set()
for item in data:
    manifest_ids.add(item["id"])

print(f"IDs in manifest: {sorted(list(manifest_ids))}")

# Check missing images
images_ids = set()
for f in files:
    # name is cni_X_recto.jpg or cni_X_verso.jpg
    parts = f.split("_")
    if len(parts) >= 2:
        try:
            images_ids.add(int(parts[1]))
        except ValueError:
            pass

print(f"IDs in images directory: {sorted(list(images_ids))}")
print(f"Images in dir not in manifest: {images_ids - manifest_ids}")
print(f"Manifest IDs not in images: {manifest_ids - images_ids}")
