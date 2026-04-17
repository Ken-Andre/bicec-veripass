# Marimo OCR Notebooks

Interactive notebooks for testing and developing the OCR pipeline for BICEC Veripass.

## Quick Start

```bash
# Activate the OCR virtual environment
cd paddleocr_test
.venv_ocr\Scripts\activate   # Windows

# Run a notebook
marimo edit notebooks/01_interactive_ocr_testing.py
marimo edit notebooks/02_synthetic_cni_generation.py
marimo edit notebooks/03_ocr_accuracy_dashboard.py
marimo edit notebooks/04_eneo_sanctions_exploration.py

# Or run as a read-only web app
marimo run notebooks/01_interactive_ocr_testing.py
```

## Notebooks

| # | Notebook | Purpose |
|---|----------|---------|
| 01 | **Interactive OCR Testing** | Upload any CNI image dynamically, compare PaddleOCR vs GLM-OCR, inspect extracted fields, annotated images, and block details |
| 02 | **Synthetic CNI Generation** | Generate realistic Cameroonian CNI data (Faker), render text on templates (Pillow), augment with real-world distortions (Albumentations) |
| 03 | **OCR Accuracy Dashboard** | Batch-test engines, compare per-field accuracy against ground truth, confidence distribution analysis |
| 04 | **ENEO & Sanctions Exploration** | ENEO bill OCR extraction + PEP/sanctions screening simulation with fuzzy name search and risk analysis |

## GLM-OCR Setup (Optional)

If you have GLM-OCR GGUF model files:

1. Place them anywhere on disk (e.g., `C:\Users\yoann\Downloads\`)
2. The notebooks will auto-detect `.gguf` files in common locations
3. Or paste the path manually in the notebook's model selector

Required files:
- `GLM-OCR.i1-Q4_K_M.gguf` (main model)
- `mmproj-GLM-OCR-Q8_0.gguf` (multimodal projector, auto-detected)

## Dependencies

All installed in `.venv_ocr`:

```
marimo          # Interactive notebooks
paddleocr       # OCR engine
paddlepaddle    # ML framework
faker           # Synthetic data generation
albumentations  # Image augmentation
llama-cpp-python # GLM-OCR inference
pillow          # Image processing
opencv-python   # Computer vision
numpy           # Numerical computing
```

## Architecture

```
notebooks/
├── ocr_utils.py              # Shared OCR utilities (both engines, alignment, extraction)
├── 01_interactive_ocr_testing.py
├── 02_synthetic_cni_generation.py
├── 03_ocr_accuracy_dashboard.py
├── 04_eneo_sanctions_exploration.py
├── README.md
└── output/                    # Generated datasets (gitignored)
```
