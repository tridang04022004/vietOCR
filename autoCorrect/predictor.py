"""Spelling correction predictor using transformer model."""

import torch
import pickle
from pathlib import Path
from typing import Optional


class CharVocab:
    """Character-level vocabulary."""

    def __init__(self):
        self.char2idx = {}
        self.idx2char = {}
        self.special_tokens = {
            '<PAD>': 0,
            '<SOS>': 1,
            '<EOS>': 2,
            '<UNK>': 3,
        }
        self.char2idx.update(self.special_tokens)
        self.idx2char = {v: k for k, v in self.char2idx.items()}

    def encode(self, text: str, add_special_tokens: bool = True):
        """Convert text to indices."""
        indices = [self.char2idx.get(c, self.char2idx['<UNK>']) for c in text]
        if add_special_tokens:
            indices = [self.char2idx['<SOS>']] + indices + [self.char2idx['<EOS>']]
        return indices

    def decode(self, indices, remove_special_tokens: bool = True):
        """Convert indices to text."""
        chars = []
        for idx in indices:
            char = self.idx2char.get(idx, '<UNK>')
            if remove_special_tokens and char in self.special_tokens:
                continue
            chars.append(char)
        return ''.join(chars)

    def __len__(self):
        return len(self.char2idx)

    def save(self, path: str):
        """Save vocabulary to file."""
        with open(path, 'wb') as f:
            pickle.dump({
                'char2idx': self.char2idx,
                'idx2char': self.idx2char,
            }, f)

    def load(self, path: str):
        """Load vocabulary from file."""
        with open(path, 'rb') as f:
            data = pickle.load(f)
            self.char2idx = data['char2idx']
            self.idx2char = data['idx2char']


class BaselineTransformer(torch.nn.Module):
    """Baseline transformer for spelling correction."""

    def __init__(
        self,
        vocab_size: int,
        d_model: int = 256,
        nhead: int = 8,
        num_encoder_layers: int = 4,
        num_decoder_layers: int = 4,
        dim_feedforward: int = 1024,
        dropout: float = 0.1,
        max_len: int = 512,
    ):
        super().__init__()
        self.d_model = d_model
        self.vocab_size = vocab_size

        self.embedding = torch.nn.Embedding(vocab_size, d_model)
        self.pos_encoder = self._create_positional_encoding(d_model, max_len, dropout)

        self.transformer = torch.nn.Transformer(
            d_model=d_model,
            nhead=nhead,
            num_encoder_layers=num_encoder_layers,
            num_decoder_layers=num_decoder_layers,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True,
        )

        self.output_projection = torch.nn.Linear(d_model, vocab_size)
        self._init_weights()

    def _create_positional_encoding(self, d_model: int, max_len: int = 5000, dropout: float = 0.1):
        """Create sinusoidal positional encoding."""
        import math

        class PositionalEncoding(torch.nn.Module):
            def __init__(self, d_model, max_len, dropout):
                super().__init__()
                self.dropout = torch.nn.Dropout(p=dropout)
                pe = torch.zeros(max_len, d_model)
                position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
                div_term = torch.exp(
                    torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
                )
                pe[:, 0::2] = torch.sin(position * div_term)
                pe[:, 1::2] = torch.cos(position * div_term)
                pe = pe.unsqueeze(0)
                self.register_buffer('pe', pe)

            def forward(self, x):
                x = x + self.pe[:, :x.size(1), :]
                return self.dropout(x)

        return PositionalEncoding(d_model, max_len, dropout)

    def _init_weights(self):
        """Initialize weights."""
        initrange = 0.1
        self.embedding.weight.data.uniform_(-initrange, initrange)
        self.output_projection.bias.data.zero_()
        self.output_projection.weight.data.uniform_(-initrange, initrange)

    def generate_square_subsequent_mask(self, sz: int) -> torch.Tensor:
        """Generate causal mask for decoder."""
        mask = torch.triu(torch.ones(sz, sz), diagonal=1)
        mask = mask.masked_fill(mask == 1, float('-inf'))
        return mask

    def forward(self, src: torch.Tensor, tgt: torch.Tensor, src_mask=None, tgt_mask=None):
        """Forward pass."""
        import math

        src_emb = self.embedding(src) * math.sqrt(self.d_model)
        src_emb = self.pos_encoder(src_emb)

        tgt_emb = self.embedding(tgt) * math.sqrt(self.d_model)
        tgt_emb = self.pos_encoder(tgt_emb)

        tgt_len = tgt.size(1)
        tgt_causal_mask = self.generate_square_subsequent_mask(tgt_len).to(tgt.device)

        src_key_padding_mask = (src == 0) if src_mask is None else (src_mask == 0)
        tgt_key_padding_mask = (tgt == 0) if tgt_mask is None else (tgt_mask == 0)

        output = self.transformer(
            src_emb,
            tgt_emb,
            tgt_mask=tgt_causal_mask,
            src_key_padding_mask=src_key_padding_mask,
            tgt_key_padding_mask=tgt_key_padding_mask,
        )

        logits = self.output_projection(output)
        return logits

    @torch.no_grad()
    def generate(
        self,
        src: torch.Tensor,
        max_len: int = 256,
        sos_idx: int = 1,
        eos_idx: int = 2,
    ):
        """Generate corrected sequence."""
        self.eval()
        batch_size = src.size(0)
        device = src.device

        memory = self.encode_source(src)
        tgt = torch.full((batch_size, 1), sos_idx, dtype=torch.long, device=device)
        finished = torch.zeros(batch_size, dtype=torch.bool, device=device)

        for _ in range(max_len - 1):
            logits = self.decode_step(tgt, memory)
            next_token = logits[:, -1, :].argmax(dim=-1, keepdim=True)
            tgt = torch.cat([tgt, next_token], dim=1)
            finished |= (next_token.squeeze(-1) == eos_idx)

            if finished.all():
                break

        return tgt

    def encode_source(self, src: torch.Tensor):
        """Encode source sequence."""
        import math

        src_emb = self.embedding(src) * math.sqrt(self.d_model)
        src_emb = self.pos_encoder(src_emb)
        src_key_padding_mask = (src == 0)

        memory = self.transformer.encoder(
            src_emb,
            src_key_padding_mask=src_key_padding_mask,
        )

        return memory

    def decode_step(self, tgt: torch.Tensor, memory: torch.Tensor, tgt_mask=None):
        """Single decoding step."""
        import math

        tgt_emb = self.embedding(tgt) * math.sqrt(self.d_model)
        tgt_emb = self.pos_encoder(tgt_emb)

        tgt_len = tgt.size(1)
        tgt_causal_mask = self.generate_square_subsequent_mask(tgt_len).to(tgt.device)
        tgt_key_padding_mask = (tgt == 0) if tgt_mask is None else (tgt_mask == 0)

        output = self.transformer.decoder(
            tgt_emb,
            memory,
            tgt_mask=tgt_causal_mask,
            tgt_key_padding_mask=tgt_key_padding_mask,
        )

        logits = self.output_projection(output)
        return logits


class SpellingCorrector:
    """Vietnamese spelling correction predictor."""

    def __init__(
        self,
        checkpoint_path: str,
        vocab_path: str,
        device: Optional[str] = None,
    ):
        """
        Initialize spelling corrector.

        Args:
            checkpoint_path: Path to model checkpoint
            vocab_path: Path to vocabulary file
            device: Device to use ('cuda' or 'cpu'), auto-detect if None
        """
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')

        # Load vocabulary
        self.vocab = CharVocab()
        self.vocab.load(vocab_path)

        # Load model
        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        self.model = BaselineTransformer(vocab_size=len(self.vocab))
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model = self.model.to(self.device)
        self.model.eval()

    def predict(self, text: str) -> str:
        """
        Predict spelling correction.

        Args:
            text: Input text with spelling errors

        Returns:
            Corrected text
        """
        # Encode input
        src_idx = torch.tensor(
            self.vocab.encode(text, add_special_tokens=True),
            dtype=torch.long
        ).unsqueeze(0).to(self.device)

        # Generate prediction
        with torch.no_grad():
            generated = self.model.generate(
                src_idx,
                max_len=256,
                sos_idx=self.vocab.char2idx['<SOS>'],
                eos_idx=self.vocab.char2idx['<EOS>'],
            )

        # Decode output
        return self.vocab.decode(generated[0].tolist(), remove_special_tokens=True)

    def predict_batch(self, texts: list) -> list:
        """
        Predict spelling correction for multiple texts.

        Args:
            texts: List of input texts

        Returns:
            List of corrected texts
        """
        return [self.predict(text) for text in texts]
