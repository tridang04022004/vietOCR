import cv2
import numpy as np
from pathlib import Path
from typing import List, Tuple, Dict, Optional
import json

#######################THRESHOLD SETTINGS, DUMB FUCKS DO NOT TOUCH
#txtSize = 20
#minLineRatio = 0.7
#lineContinuity = 0.85
#gapTolerance = 10
#mergeDistance = 5
#cropThreshold = 255
#cropMargin = 5

def cropPadding(image):
    cropThreshold = 255
    cropMargin = 5
    if len(image.shape) == 3:
        img = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        img = image.copy()
    
    nonWhite = img < cropThreshold

    nonWhiteRows = np.any(nonWhite, axis = 1)
    nonWhiteCols = np.any(nonWhite, axis = 0)

    rowIndices = np.where(nonWhiteRows)[0]
    colIndices = np.where(nonWhiteCols)[0]

    if len(rowIndices) == 0 or len(colIndices) == 0:
        return image
    
    y1 = rowIndices[0]
    y2 = rowIndices[-1] + 1
    x1 = colIndices[0]
    x2 = colIndices[-1] + 1

    y1 = max(0, y1 - cropMargin)               
    y2 = min(image.shape[0], y2 + cropMargin) 
    x1 = max(0, x1 - cropMargin)
    x2 = min(image.shape[1], x2 + cropMargin)

    crop = image[y1:y2, x1:x2]
    return crop

def deskew(image):
    coords = np.column_stack(np.where(image > 0))
    if len(coords) < 10:
        return image 
    
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    elif angle > 45:
        angle = angle - 90

    if abs(angle) < 0.5:
        return image 
    
    h, w = image.shape
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        image,
        M,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0
    )
    return rotated

def preprocess(image):
    if len(image.shape) == 3:
        img = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        img = image.copy()
    img = cv2.fastNlMeansDenoising(img, h=10)
    img = cv2.adaptiveThreshold(
        img, 
        255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV,
        15,
        10
    )
    img = deskew(img)
    return img 

def calTableLine(line):
    runs = []
    inRun = False 
    start = 0

    for i, val in enumerate(line):
        if val > 0:
            if not inRun:
                inRun = True
                start = i
        else:
            if inRun:
                runs.append((start, i - start))
                inRun = False
    if inRun:
        runs.append((start, len(line) - start))
    return runs

def isValidTableLine(runs, length, isHorizontal):
    gapTolerance = 10
    minLineRatio = 0.7
    txtSize = 20
    if not runs:
        return False
    longRuns = []
    for r in runs:
        if r[1] > txtSize:
            longRuns.append(r)
    if not longRuns:
        return False
    
    coverage = 0
    for r in longRuns:
        coverage += r[1]
    coverageRatio = coverage / length
    if coverageRatio < minLineRatio:
        return False
    
    sortedRuns = sorted(longRuns, key=lambda x: x[0])
    gaps = []

    for i in range(len(sortedRuns) - 1):
        endCurrent = sortedRuns[i][0] + sortedRuns[i][1]
        startNext = sortedRuns[i + 1][0]
        gap = startNext - endCurrent
        gaps.append(gap)
    if gaps:
        smallGaps = []
        for g in gaps:
            if g <= gapTolerance:
                smallGaps.append(g)
        continuityScore = len(smallGaps) / len(gaps)
    else:
        continuityScore = 1.0
    return continuityScore >= 0.85

def mergeLines(lines):
    if not lines:
        return []
    lines = sorted(lines)
    merged = []
    currentGroup = [lines[0]]
    for i in range(1, len(lines)):
        if lines[i] - lines[i - 1] <= 5:
            currentGroup.append(lines[i])
        else:
            merged.append(int(np.median(currentGroup)))
            currentGroup = [lines[i]]
    merged.append(int(np.median(currentGroup)))
    return merged

def detectHorizontalLine(image):
    h, w = image.shape 
    lines = []
    for y in range(h):
        row = image[y, :]
        runs = calTableLine(row)
        if isValidTableLine(runs, w, isHorizontal=True):
            lines.append(y)
    lines = mergeLines(lines)
    return lines

def detectVerticalLine(image):
    h, w = image.shape 
    lines = []
    for x in range(w):
        col = image[:, x]
        runs = calTableLine(col)
        if isValidTableLine(runs, h, isHorizontal=False):
            lines.append(x)
    lines = mergeLines(lines)
    return lines 

def extractCells(hLines, vLines, imageShape):
    h, w = imageShape
    hLines = sorted(set([0] + hLines + [h - 1]))
    vLines = sorted(set([0] + vLines + [w - 1]))
    cells = []
    for i in range(len(hLines) - 1):
        for j in range(len(vLines) - 1):
            y1 = hLines[i]
            y2 = hLines[i + 1]
            x1 = vLines[j]
            x2 = vLines[j + 1]
            cell_w = x2 - x1
            cell_h = y2 - y1
            if cell_w < 10 or cell_h <10:
                continue
            cells.append({
                'row': i,
                'col': j,
                'x': x1,
                'y': y1,
                'w': cell_w,
                'h': cell_h
            })
    return cells

def filterCells(cells):
    if not cells:
        return []
    uniqueCells = []
    seen = set()
    
    for cell in cells:
        key = (cell['row'], cell['col'], cell['x'], cell['y'], cell['w'], cell['h'])
        if key not in seen:
            seen.add(key)
            uniqueCells.append(cell)
    filtered = []

    for i, cell1 in enumerate(uniqueCells):
        isNested = False
        for j, cell2 in enumerate(uniqueCells):
            if i == j:
                continue
            if (cell1['x'] >= cell2['x'] and
                cell1['y'] >= cell2['y'] and
                cell1['x'] + cell1['w'] <= cell2['x'] + cell2['w'] and
                cell1['y'] + cell1['h'] <= cell2['y'] + cell2['h'] and
                (cell1['w'] < cell2['w'] or cell1['h'] < cell2['h'])):
                isNested = True
                break
        if not isNested:
            filtered.append(cell1)
    return filtered

def saveCells(image, cells, outDir):
    tableData = {
        'num_cells': len(cells),
        'cells': cells
    }
    with open(outDir / 'tableData.json', 'w', encoding='utf-8') as f:
        json.dump(tableData, f, indent=2, ensure_ascii=False)
    
    for cell in cells:
        x, y, w, h = cell['x'], cell['y'], cell['w'], cell['h']
        row, col = cell['row'], cell['col']
        cellCrop = image[y:y+h, x:x+w]
        filename = f"cell_r{row:02d}_c{col:02d}.png"
        cv2.imwrite(str(outDir/ filename), cellCrop)

def processTable(image, outDir):
    img = cv2.imread(str(image))
    img_original = img.copy()
    img = cropPadding(img)
    img = preprocess(img)
    hLines = detectHorizontalLine(img)
    vLines = detectVerticalLine(img)
    cells = extractCells(hLines, vLines, img.shape)
    cells = filterCells(cells)
    saveCells(img_original, cells, outDir)