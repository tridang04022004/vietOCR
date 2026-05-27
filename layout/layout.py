import os
import cv2
from ultralytics import YOLO   
from layout.cleanOverlaps import cleanOverlaps  

def predictLayout(image, outputDir):
    _dir = os.path.dirname(os.path.abspath(__file__))
    model = YOLO(os.path.join(_dir, "layout.pt"))
    img = cv2.imread(image)
    print(f"[Layout] Input image dimensions: {img.shape}")
    rs = model.predict(image, conf=0.25, device = 0, save = False, verbose = True)

    layout_data = []  # Store bbox data for visualization

    for predict in rs:
        print(f"[Layout] YOLO prediction image shape: {predict.orig_shape}")
        raw_bbox  = predict.boxes.xyxy.cpu().numpy()
        raw_cls   = predict.boxes.cls.cpu().numpy().astype(int)
        raw_conf  = predict.boxes.conf.cpu().numpy()
        bbox, cls, conf = cleanOverlaps(raw_bbox, raw_cls, raw_conf)

        h, w = img.shape[:2]
        print(f"[Layout] Processing {len(bbox)} boxes on image {w}x{h}")
        for i in range(len(bbox)):
            clsId = int(cls[i])
            confidence = float(conf[i])
            x1, y1, x2, y2 = map(int, bbox[i])
            x1 = x1 - 5
            y1 = y1 - 5
            x2 = x2 + 5
            y2 = y2 + 5
            crop = img[y1:y2, x1:x2]
            crop_cls = predict.names[clsId]
            crop_name = f"y{y1}_{crop_cls}_{i:02d}_{confidence:.2f}.png"
            cv2.imwrite(os.path.join(outputDir, crop_name), crop)

            # Store bbox data for visualization
            layout_data.append({
                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                "class": crop_cls,
                "confidence": float(confidence),
                "block_id": i
            })

    return layout_data


        

