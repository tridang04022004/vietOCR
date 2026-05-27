# Vietnamese Spelling Correction Module

A self-contained module for Vietnamese spelling correction using transformer models.

## Setup

### 1. Add Model Weights

Place your trained model checkpoint and vocabulary file in this directory:

```
Module/
├── checkpoints/
│   ├── best_model.pt          # Model weights (you provide)
│   └── vocab.pkl              # Vocabulary (you provide)
└── ...
```

### 2. Install Dependencies

```bash
pip install torch
```

## Usage

### Basic Usage

```python
from Module import SpellingCorrector

# Initialize
corrector = SpellingCorrector(
    checkpoint_path='Module/checkpoints/best_model.pt',
    vocab_path='Module/checkpoints/vocab.pkl'
)

# Single prediction
result = corrector.predict("Hom nay troi dep qua")
print(result)  # Output: "Hôm nay trời đẹp quá"

# Batch prediction
texts = ["Hom nay troi dep qua", "Xin chao"]
results = corrector.predict_batch(texts)
for text, corrected in zip(texts, results):
    print(f"{text} -> {corrected}")
```

### Specify Device

```python
# Use GPU
corrector = SpellingCorrector(
    checkpoint_path='Module/checkpoints/best_model.pt',
    vocab_path='Module/checkpoints/vocab.pkl',
    device='cuda'
)

# Use CPU
corrector = SpellingCorrector(
    checkpoint_path='Module/checkpoints/best_model.pt',
    vocab_path='Module/checkpoints/vocab.pkl',
    device='cpu'
)
```

## Module Structure

- `__init__.py` - Package initialization
- `predictor.py` - Main predictor class and model architecture
  - `SpellingCorrector` - Main class for predictions
  - `BaselineTransformer` - Model architecture
  - `CharVocab` - Vocabulary handler

## Classes

### SpellingCorrector

Main class for spelling correction.

**Methods:**

- `__init__(checkpoint_path, vocab_path, device=None)` - Initialize with model and vocabulary
- `predict(text: str) -> str` - Correct a single text
- `predict_batch(texts: list) -> list` - Correct multiple texts

## How to Integrate into Another Project

1. Copy the `Module/` folder to your project
2. Place your model weights and vocabulary in `Module/checkpoints/`
3. Import and use:

```python
from Module import SpellingCorrector

corrector = SpellingCorrector(
    checkpoint_path='path/to/best_model.pt',
    vocab_path='path/to/vocab.pkl'
)

corrected_text = corrector.predict(input_text)
```

## Model Details

- **Architecture**: Baseline Transformer (Seq2Seq)
- **Encoder**: 4 layers, 8 attention heads
- **Decoder**: 4 layers, 8 attention heads
- **Model dimension**: 256
- **Feed-forward dimension**: 1024
- **Vocabulary**: Character-level (Vietnamese)

## Notes

- The module is self-contained with no external dependencies except PyTorch
- All model code is embedded, no need to maintain separate source files
- Vocabulary must be provided in pickle format
- Model checkpoint must contain `model_state_dict` key
