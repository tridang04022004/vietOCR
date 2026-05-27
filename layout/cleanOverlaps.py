import numpy as np

def area(box):
    #box[x1, y1, x2, y2]
    return max(0, box[2] - box[0]) * max(0, box[3] - box[1])

def intersection(a, b):
    #a[x1, y1, x2, y2], b[x1, y1, x2, y2]
    ix1 = max(a[0], b[0])
    iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2])
    iy2 = min(a[3], b[3])
    return max(0, ix2 - ix1) * max(0, iy2 - iy1)

def iouCal(a, b):
    inter = intersection(a, b)
    n = area(a) + area(b) - inter
    iou = inter / n
    return iou

def ioaCal(a, b):
    inter = intersection(a, b)
    smaller = min(area(a), area(b))
    ioa = inter / smaller
    if smaller <= 0: 
        return 0
    return ioa

def scoreCal(cls, conf):
    if int(cls) == 3:
        tier = 1
    else: tier = 0
    return (tier, float(conf))

def cleanOverlaps(bbox, cls, conf):
    if len(bbox) == 0:
        return bbox, cls, conf
    n = len(bbox)
    keep = [True]*n
    for i in range(n):
        if not keep[i]:
            continue
        for j in range (i + 1, n):
            if not keep[j]:
                continue

            inter = intersection(bbox[i], bbox[j])
            if inter == 0:
                continue

            ioa = ioaCal(bbox[i], bbox[j])
            if ioa >= 0.85:
                if area(bbox[i]) >= area(bbox[j]):
                    keep[j] = False
                else: keep[i] = False

            else:
                iou = iouCal(bbox[i], bbox[j])
                if iou >= 0.3:
                    score_i = scoreCal(cls[i], conf[i])
                    score_j = scoreCal(cls[j], conf[j])
                    if score_i >= score_j:
                        keep[j] = False
                    else:
                        keep [i] = False
                        break
    kept = []
    for k in range(n):
        if keep[k]:
            kept.append(k)

    return bbox[kept], cls[kept], conf[kept]