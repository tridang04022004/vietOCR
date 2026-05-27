"""
AutoCorrect Wrapper Module

Provides line-by-line Vietnamese spelling correction for markdown documents.
Preserves markdown structure (headers, tables, lists) while correcting text content.
"""

import re
from pathlib import Path
from typing import Optional
from .predictor import SpellingCorrector

# Global singleton corrector instance
_corrector: Optional[SpellingCorrector] = None


def load_corrector(device: str = "cuda") -> SpellingCorrector:
    """
    Load spelling corrector singleton.

    Args:
        device: Device to use ('cuda' or 'cpu')

    Returns:
        SpellingCorrector instance
    """
    global _corrector

    if _corrector is None:
        print(f"[AutoCorrect] Loading spelling corrector on {device}...")

        # Get paths relative to this file
        module_dir = Path(__file__).parent
        checkpoint_path = str(module_dir / "best_model.pt")
        vocab_path = str(module_dir / "vocab.pkl")

        _corrector = SpellingCorrector(
            checkpoint_path=checkpoint_path,
            vocab_path=vocab_path,
            device=device
        )

        print(f"[AutoCorrect] Corrector loaded successfully")

    return _corrector


def is_markdown_syntax_line(line: str) -> bool:
    """
    Check if a line is markdown syntax that should not be corrected.

    Args:
        line: Line of text

    Returns:
        True if line is markdown syntax, False otherwise
    """
    stripped = line.strip()

    # Empty lines
    if not stripped:
        return True

    # Headers (### Title)
    if stripped.startswith('#'):
        return False  # We want to correct header text

    # Horizontal rules (---, ___, ***)
    if re.match(r'^[-_*]{3,}$', stripped):
        return True

    # Table separators (|---|---|)
    if re.match(r'^\|[\s\-:|]+\|$', stripped):
        return True

    # Table rows start with | but contain text - we want to correct these
    # List items (-, *, +, 1.) - we want to correct these

    return False


def correct_line(line: str, corrector: SpellingCorrector) -> str:
    """
    Correct a single line of text, preserving markdown syntax.

    Args:
        line: Line of text to correct
        corrector: SpellingCorrector instance

    Returns:
        Corrected line
    """
    # Skip empty lines and pure markdown syntax
    if is_markdown_syntax_line(line):
        return line

    stripped = line.strip()

    # Handle headers - correct the text after the # symbols
    if stripped.startswith('#'):
        match = re.match(r'^(#+\s*)(.*)', stripped)
        if match:
            prefix, text = match.groups()
            if text:
                try:
                    corrected_text = corrector.predict(text)
                    return prefix + corrected_text + '\n' if line.endswith('\n') else prefix + corrected_text
                except Exception as e:
                    print(f"[AutoCorrect] Error correcting header: {e}")
                    return line
        return line

    # Handle table rows - correct text in each cell
    if '|' in stripped:
        try:
            # Split by | and correct each cell
            parts = stripped.split('|')
            corrected_parts = []

            for part in parts:
                cell_text = part.strip()
                if cell_text and not re.match(r'^[-:]+$', cell_text):  # Not a separator
                    try:
                        corrected_parts.append(corrector.predict(cell_text))
                    except:
                        corrected_parts.append(cell_text)
                else:
                    corrected_parts.append(part)

            result = '|'.join(corrected_parts)
            return result + '\n' if line.endswith('\n') else result
        except Exception as e:
            print(f"[AutoCorrect] Error correcting table row: {e}")
            return line

    # Handle list items - correct text after the marker
    list_match = re.match(r'^(\s*[-*+]\s+|\s*\d+\.\s+)(.*)', stripped)
    if list_match:
        prefix, text = list_match.groups()
        if text:
            try:
                corrected_text = corrector.predict(text)
                return prefix + corrected_text + '\n' if line.endswith('\n') else prefix + corrected_text
            except Exception as e:
                print(f"[AutoCorrect] Error correcting list item: {e}")
                return line
        return line

    # Regular text line - correct the entire line
    try:
        corrected = corrector.predict(stripped)
        return corrected + '\n' if line.endswith('\n') else corrected
    except Exception as e:
        print(f"[AutoCorrect] Error correcting line: {e}")
        return line


def correct_markdown(markdown: str, device: str = "cuda") -> str:
    """
    Correct spelling in markdown document line-by-line.

    Preserves markdown structure:
    - Headers (###)
    - Tables (| cell |)
    - Lists (-, *, 1.)
    - Horizontal rules (---)
    - Empty lines

    Args:
        markdown: Markdown content to correct
        device: Device to use ('cuda' or 'cpu')

    Returns:
        Corrected markdown content
    """
    try:
        # Load corrector
        corrector = load_corrector(device)

        # Split into lines
        lines = markdown.split('\n')

        # Correct each line
        corrected_lines = []
        for i, line in enumerate(lines):
            if i % 10 == 0 and i > 0:
                print(f"[AutoCorrect] Processing line {i}/{len(lines)}...")

            corrected_line = correct_line(line, corrector)
            # Remove trailing newline since we'll join with \n
            corrected_lines.append(corrected_line.rstrip('\n'))

        # Join back together
        result = '\n'.join(corrected_lines)

        print(f"[AutoCorrect] Completed correction of {len(lines)} lines")
        return result

    except Exception as e:
        print(f"[AutoCorrect] Error during markdown correction: {e}")
        import traceback
        traceback.print_exc()
        # Return original markdown if correction fails
        return markdown


if __name__ == "__main__":
    # Test the autocorrect module
    test_markdown = """### Tieu de tai lieu

Hom nay troi dep qua. Chung toi di hoc.

| Ten | Tuoi | Dia chi |
|---|---|---|
| Nguyen Van A | 25 | Ha Noi |
| Tran Thi B | 30 | Sai Gon |

- Muc thu nhat
- Muc thu hai

Day la mot doan van ban thuong.
"""

    print("Original:")
    print(test_markdown)
    print("\n" + "="*50 + "\n")

    corrected = correct_markdown(test_markdown, device="cpu")

    print("Corrected:")
    print(corrected)
