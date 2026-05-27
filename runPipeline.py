import os
import sys
import cv2
import argparse
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple

from layout.layout import predictLayout
from line.line import cutLine
from table.table import processTable
from ocr.ocr import runOCR, loadPredictor 

from ultralytics import YOLO
import numpy as np
from PIL import Image
from doctr.io import DocumentFile
from doctr.models import detection_predictor
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg



def runPipeline(image):
    device = "cuda"
    outDir = Path("Output")
    outDir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    runDir = outDir / timestamp
    runDir.mkdir(exist_ok=True)

    mdOutput = runDir / f"{timestamp}.md"
    mdOutput.touch()

    # Copy original image for visualization
    original_img = cv2.imread(image)
    print(f"[Pipeline] Original image dimensions: {original_img.shape}")
    cv2.imwrite(str(runDir / "original.png"), original_img)
    img_height, img_width = original_img.shape[:2]

    # Initialize visualization data structure
    visualization_data = {
        "image_width": int(img_width),
        "image_height": int(img_height),
        "layout": [],
        "lines": {},
        "tables": {}
    }

    ocr_predictor = loadPredictor(device)

    # Get layout data with bbox information
    print(f"[Pipeline] Running layout detection on image: {image}")
    layout_data = predictLayout(image, runDir)
    print(f"[Pipeline] Found {len(layout_data)} layout blocks")
    visualization_data["layout"] = layout_data

    crops = sorted(
        [f for f in runDir.iterdir() if f.suffix == ".png" and f.name != "original.png"],
        key=lambda f: int(f.name.split("_")[0][1:])
    )

    for i, crop in enumerate(crops):
        parts = crop.stem.split("_")
        cls = parts[1]
        blockDir = runDir / f"block_{i}_{cls}"
        blockDir.mkdir(exist_ok=True)

        if cls == "table":
            processTable(crop, blockDir)
            tableData = blockDir / "tableData.json"
            with open(tableData, "r", encoding="utf-8") as f:
                tableData = json.load(f)
            cellsInfo = tableData["cells"]

            # Store table data for visualization
            visualization_data["tables"][f"block_{i}"] = {
                "cells": cellsInfo,
                "grid": {
                    "rows": max(cell["row"] for cell in cellsInfo) + 1,
                    "cols": max(cell["col"] for cell in cellsInfo) + 1
                }
            }

            maxRow = max(cell["row"] for cell in cellsInfo)
            maxCol = max(cell["col"] for cell in cellsInfo)
            tableGrid = [[None for _ in range(maxCol + 1)] for _ in range(maxRow + 1)]
            cells = sorted(
                [f for f in blockDir.iterdir() if f.name.startswith("cell_") and f.suffix == ".png"],
                key=lambda f: (int(f.name.split("_")[1][1:]), int(f.name.split("_")[2][1:].split(".")[0]))
            )
            for cell in cells:
                row = int(cell.name.split("_")[1][1:])
                col = int(cell.name.split("_")[2][1:].split(".")[0])
                cellDir = blockDir / f"cell_r{row:02d}_c{col:02d}"
                cellDir.mkdir(exist_ok=True)
                line_data = cutLine(cell, device, cellDir)

                # Store line data for this table cell
                cell_key = f"block_{i}_cell_r{row:02d}_c{col:02d}"
                visualization_data["lines"][cell_key] = line_data

                lines = sorted(
                    [f for f in cellDir.iterdir() if f.suffix == ".png"],
                    key=lambda f: int(f.name.split("_")[0])
                )
                cell_text = []
                for line in lines:
                    text = runOCR(line, ocr_predictor)
                    cell_text.append(text)
                tableGrid[row][col] = " ".join(cell_text) # type: ignore
            with open(mdOutput, "a", encoding="utf-8") as f:
                f.write("| " + " | ".join([str(i) for i in range(maxCol + 1)]) + " |\n")
                f.write("|" + "|".join(["---" for _ in range(maxCol + 1)]) + "|\n")
                for row in tableGrid:
                    row_text = [cell if cell else "" for cell in row]
                    f.write("| " + " | ".join(row_text) + " |\n")
                f.write("\n")
        elif cls == "text":
            line_data = cutLine(crop, device, blockDir)

            # Store line data for visualization
            visualization_data["lines"][f"block_{i}"] = line_data

            lines = sorted(
                [f for f in blockDir.iterdir() if f.suffix == ".png"],
                key=lambda f: int(f.name.split("_")[0])
            )
            all_text = []
            for j, line in enumerate(lines):
                text = runOCR(line, ocr_predictor)
                all_text.append(text)
            with open(mdOutput, "a", encoding="utf-8") as f:
                f.write(" ".join(all_text) + "\n")
        elif cls == "title":
            line_data = cutLine(crop, device, blockDir)

            # Store line data for visualization
            visualization_data["lines"][f"block_{i}"] = line_data

            lines = sorted(
                [f for f in blockDir.iterdir() if f.suffix == ".png"],
                key=lambda f: int(f.name.split("_")[0])
            )
            all_text = []
            for j, line in enumerate(lines):
                text = runOCR(line, ocr_predictor)
                all_text.append(text)
            with open(mdOutput, "a", encoding="utf-8") as f:
                f.write("### " + " ".join(all_text) + "\n")
        elif cls == "figure":
            pass
        else:
            pass

    # Save visualization data to JSON
    visualization_file = runDir / "visualization.json"
    with open(visualization_file, "w", encoding="utf-8") as f:
        json.dump(visualization_data, f, indent=2, ensure_ascii=False)

    # Run autocorrect on the generated markdown
    print(f"[Pipeline] Running autocorrect on markdown...")
    try:
        from autoCorrect.autocorrect import correct_markdown

        # Read the original markdown
        with open(mdOutput, "r", encoding="utf-8") as f:
            original_markdown = f.read()

        # Correct the markdown
        corrected_markdown = correct_markdown(original_markdown, device=device)

        # Save corrected version
        corrected_output = runDir / f"{timestamp}_corrected.md"
        with open(corrected_output, "w", encoding="utf-8") as f:
            f.write(corrected_markdown)

        print(f"[Pipeline] Autocorrect completed. Saved to {corrected_output}")
    except Exception as e:
        print(f"[Pipeline] Autocorrect failed: {e}")
        import traceback
        traceback.print_exc()
        # Continue without autocorrect if it fails


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run OCR pipeline on a document image.")
    parser.add_argument("image", help="Path to the input image file")
    args = parser.parse_args()
    runPipeline(args.image)
