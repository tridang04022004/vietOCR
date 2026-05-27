import cv2
import numpy as np 

def paddedCrop(image, bbox, padding = 5):
    h, w = image.shape[:2]
    x1, y1, x2, y2 = bbox
    x1 = max(0, x1 - padding)
    y1 = max(0, y1 - padding)
    x2 = min(w, x2 + padding)
    y2 = min(h, y2 + padding)
    crop = image[y1:y2, x1:x2].copy()
    return crop

def voronoiCal(bbox, h):
    centers = []
    for b in bbox:
        c = (b[1] + b[3]) / 2
        centers.append(c)
    cuts = []
    for i, y in enumerate(centers):
        if i == 0:
            top = 0
        else:
            top = int((centers[i - 1] + y) / 2)
        
        if i == len(centers) - 1:
            bottom = h 
        else:
            bottom = int((y + centers[i + 1]) / 2)

        cuts.append((top, bottom))
    return cuts

def voronoiPad(crop, bbox, top, bottom, padding = 15):
    y1 = bbox[1]
    Y1 = y1 - padding

    cropTop = top - Y1
    cropBottom = bottom - Y1 

    rs = crop.copy()
    cropHeight = rs.shape[0]

    if cropTop > 0:
        rs[: max(0, cropTop), :] = 255
    if cropBottom < cropHeight:
        rs[min(cropHeight, cropBottom) :, :] = 255
    return rs