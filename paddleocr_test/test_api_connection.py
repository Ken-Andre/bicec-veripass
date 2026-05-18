import requests
import json
from pathlib import Path

url = "http://localhost:8001/api/v1/ocr/extract/upload"
image_path = Path(r"c:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\paddleocr_test\notebooks\output\images\cni_0_recto.jpg")

if not image_path.exists():
    print(f"File not found: {image_path}")
    exit(1)

with open(image_path, "rb") as f:
    files = {"file": (image_path.name, f, "image/jpeg")}
    response = requests.post(url, files=files)

print(f"Status Code: {response.status_code}")
if response.status_code == 200:
    print("Response Data:")
    print(json.dumps(response.json(), indent=2))
else:
    print(f"Error: {response.text}")
