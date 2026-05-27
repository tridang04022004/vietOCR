import os
import argparse
from pathlib import Path
from PIL import Image 
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

#weights = "transformerocr.pth"

def loadModel(weights, device):
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "finetuneConfig.yml")
    config = Cfg.load_config_from_file(config_path)
    config["weights"] = weights
    config["cnn"]["pretrained"] = False
    config["device"] = device
    config["predictor"]["beamsearch"] = False
    return Predictor(config)

def runOCR(image, predictor):
    img = Image.open(image).convert("RGB")
    text = predictor.predict(img)
    return text


def loadPredictor(device):
    weights = os.path.join(os.path.dirname(os.path.abspath(__file__)), "transformerocr.pth")
    return loadModel(weights, device)
