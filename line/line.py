import os
import cv2
import numpy as np 
import torch 
from doctr.io import DocumentFile
from doctr.models import detection_predictor 
from line.voronoiCut import paddedCrop, voronoiCal, voronoiPad

def groupWords(bbox, gap=0.5):
    if not bbox:
        return []
    bbox = sorted(bbox, key=lambda b: (b[1] + b[3] /2))
    heights = []
    for b in bbox:
        h = b[3] - b[1]
        heights.append(h)
    median_h = float(np.median(heights))
    threshold = gap * median_h

    lines = []
    current = list(bbox[0])

    for (x1, y1, x2, y2) in bbox[1:]: 
        line_y = (current[1] + current[3]) / 2 
        word_y = (y1 + y2) / 2

        if abs(word_y - line_y) <= threshold:
            current[0] = min(current[0], x1)
            current[1] = min(current[1], y1)
            current[2] = max(current[2], x2)
            current[3] = max(current[3], y2)
        else:
            lines.append(tuple(current))
            current = [x1, y1, x2, y2]
    
    lines.append(tuple(current))
    return lines

def detectLines(model, image):
    tmp = "tmpLines.png"
    cv2.imwrite(tmp, image)
    doc = DocumentFile.from_images(tmp)
    rs = model(doc)
    os.remove(tmp)

    h, w = image.shape[:2]
    bbox = []

    for predict in rs:
        words = predict["words"]
        for word in words:
            #predicted word array format [x1, y1, x2, y2, conf]
            #predicted word has relative coord (0 - 1)
            x1r, y1r, x2r, y2r = word[:4]
            x1 = max(0, int(x1r * w))
            y1 = max(0, int(y1r * h))
            x2 = min(w, int(x2r * w))
            y2 = min(h, int(y2r * h))
            if (x2 - x1) > 2 and (y2 - y1) > 2: #2 pixels bbox are useless
                bbox.append((x1, y1, x2, y2))
    lineBbox = groupWords(bbox)
    return lineBbox

def cutLine(image, device, outDir):
    image = str(image)
    img = cv2.imread(image)
    model = detection_predictor(
        arch = 'db_resnet50',
        pretrained = True,
        assume_straight_pages=True,
    )
    model = model.to(device)
    model.eval()

    bboxes = detectLines(model, img)

    base_name = os.path.splitext(os.path.basename(image))[0]

    cuts = voronoiCal(bboxes, img.shape[0])

    line_data = []  # Store line bbox data for visualization

    for i, (bbox, (top, bottom)) in enumerate(zip(bboxes, cuts)):
        x1, y1, x2, y2 = bbox
        crop = paddedCrop(img, bbox, 5)
        clean = voronoiPad(crop, bbox, top, bottom, 5)
        cropName = f"{i:02d}_{base_name}_line{i:02d}.png"
        cropPath = os.path.join(outDir, cropName)
        cv2.imwrite(cropPath, clean)

        # Store line bbox data for visualization
        line_data.append({
            "bbox": [int(x1), int(y1), int(x2), int(y2)],
            "line_id": i
        })

    return line_data