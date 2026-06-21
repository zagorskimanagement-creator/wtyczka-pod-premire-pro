#!/usr/bin/env python3
"""
Face tracker script using OpenCV for detecting and tracking faces in video frames.
Called by the Node.js FaceTracker class with frame paths and outputs JSON.

Usage:
  python3 face_tracker.py <frame_dir> <total_frames> <fps>

Output (stdout): JSON array of face detections per frame
  [{"frame": 0, "faces": [{"x": 100, "y": 50, "width": 200, "height": 200}]}]
"""

import sys
import os
import json
import glob

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False


def detect_faces_haar(image_path: str, cascade) -> list[dict]:
    """Detect faces using Haar cascade classifier."""
    img = cv2.imread(image_path)
    if img is None:
        return []

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )

    if len(faces) == 0:
        return []

    return [
        {"x": int(x), "y": int(y), "width": int(w), "height": int(h)}
        for x, y, w, h in faces
    ]


def detect_faces_dnn(image_path: str, net) -> list[dict]:
    """Detect faces using DNN model (more accurate than Haar)."""
    img = cv2.imread(image_path)
    if img is None:
        return []

    h, w = img.shape[:2]
    blob = cv2.dnn.blobFromImage(
        cv2.resize(img, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0)
    )
    net.setInput(blob)
    detections = net.forward()

    faces = []
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence < 0.5:
            continue
        box = detections[0, 0, i, 3:7] * [w, h, w, h]
        x1, y1, x2, y2 = box.astype(int)
        faces.append(
            {
                "x": max(0, int(x1)),
                "y": max(0, int(y1)),
                "width": int(x2 - x1),
                "height": int(y2 - y1),
            }
        )

    return faces


def smooth_detections(results: list[dict], window: int = 5) -> list[dict]:
    """Smooth face positions across frames to reduce jitter."""
    if len(results) <= window:
        return results

    smoothed = []
    for i, frame_result in enumerate(results):
        if not frame_result["faces"]:
            smoothed.append(frame_result)
            continue

        start = max(0, i - window // 2)
        end = min(len(results), i + window // 2 + 1)
        neighbors = [r for r in results[start:end] if r["faces"]]

        if not neighbors:
            smoothed.append(frame_result)
            continue

        avg_x = sum(n["faces"][0]["x"] for n in neighbors) / len(neighbors)
        avg_y = sum(n["faces"][0]["y"] for n in neighbors) / len(neighbors)
        avg_w = sum(n["faces"][0]["width"] for n in neighbors) / len(neighbors)
        avg_h = sum(n["faces"][0]["height"] for n in neighbors) / len(neighbors)

        smoothed_faces = [
            {
                "x": int(avg_x),
                "y": int(avg_y),
                "width": int(avg_w),
                "height": int(avg_h),
            }
        ]
        smoothed.append({"frame": frame_result["frame"], "faces": smoothed_faces})

    return smoothed


def interpolate_missing(results: list[dict]) -> list[dict]:
    """Fill frames with no face detection using interpolation from neighbors."""
    filled = list(results)
    n = len(filled)

    for i in range(n):
        if filled[i]["faces"]:
            continue

        prev = next((j for j in range(i - 1, -1, -1) if filled[j]["faces"]), None)
        nxt = next((j for j in range(i + 1, n) if filled[j]["faces"]), None)

        if prev is not None and nxt is not None:
            ratio = (i - prev) / (nxt - prev)
            pf = filled[prev]["faces"][0]
            nf = filled[nxt]["faces"][0]
            filled[i]["faces"] = [
                {
                    "x": int(pf["x"] + ratio * (nf["x"] - pf["x"])),
                    "y": int(pf["y"] + ratio * (nf["y"] - pf["y"])),
                    "width": int(pf["width"] + ratio * (nf["width"] - pf["width"])),
                    "height": int(pf["height"] + ratio * (nf["height"] - pf["height"])),
                }
            ]
        elif prev is not None:
            filled[i]["faces"] = [dict(filled[prev]["faces"][0])]
        elif nxt is not None:
            filled[i]["faces"] = [dict(filled[nxt]["faces"][0])]

    return filled


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: face_tracker.py <frame_dir> <total_frames> <fps>"}))
        sys.exit(1)

    frame_dir = sys.argv[1]
    total_frames = int(sys.argv[2])
    fps = float(sys.argv[3])

    if not OPENCV_AVAILABLE:
        print(json.dumps({"error": "OpenCV not available", "frames": []}))
        sys.exit(1)

    if not os.path.isdir(frame_dir):
        print(json.dumps({"error": f"Frame directory not found: {frame_dir}"}))
        sys.exit(1)

    detector_type = "haar"
    net = None
    cascade = None

    prototxt = os.path.join(os.path.dirname(__file__), "models", "deploy.prototxt")
    caffemodel = os.path.join(
        os.path.dirname(__file__), "models", "res10_300x300_ssd_iter_140000.caffemodel"
    )

    if os.path.exists(prototxt) and os.path.exists(caffemodel):
        try:
            net = cv2.dnn.readNetFromCaffe(prototxt, caffemodel)
            detector_type = "dnn"
        except Exception:
            pass

    if detector_type == "haar":
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cascade = cv2.CascadeClassifier(cascade_path)
        if cascade.empty():
            print(json.dumps({"error": "Haar cascade not found"}))
            sys.exit(1)

    frame_files = sorted(glob.glob(os.path.join(frame_dir, "frame_*.jpg")))
    if not frame_files:
        frame_files = sorted(glob.glob(os.path.join(frame_dir, "*.jpg")))

    results = []
    for idx, frame_path in enumerate(frame_files):
        if detector_type == "dnn":
            faces = detect_faces_dnn(frame_path, net)
        else:
            faces = detect_faces_haar(frame_path, cascade)

        results.append({"frame": idx, "timestamp_ms": int(idx * 1000 / fps), "faces": faces})

    results = interpolate_missing(results)
    results = smooth_detections(results, window=5)

    output = {
        "detector": detector_type,
        "total_frames": len(results),
        "fps": fps,
        "frames": results,
    }

    print(json.dumps(output))


if __name__ == "__main__":
    main()
