#!/usr/bin/env python3
"""Generate public demo depth maps, never load or publish traveler media.

Run in an isolated environment with numpy, Pillow and onnxruntime installed.
See docs/DEPTH_DEMO_ASSETS.md for pinned model downloads and reproduction.
"""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import time

import numpy as np
import onnxruntime as ort
from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
MODEL = "onnx-community/depth-anything-v2-small-ONNX"
REVISION = "c3b67641fd837b2368757101311e5d21e511441e"
MODEL_SHA256 = {
    "model_q4.onnx": "240aa10a7691795f238550b76ca45388c60f8509a449df83742924fba613a2d6",
    "model_q4.onnx_data": "c85da8524066a1f7e8fdfe33501688d1b7226284b362ce22c00e650a6a51d652",
    "preprocessor_config.json": "03576db3c13dd0471fdf5f5e1428befcb95de063fe699879150b293dc9e0a2c6",
}
SAMPLES = [
    {
        "id": "chapel-bridge",
        "alt": "Chapel Bridge and the water tower across the Reuss in Lucerne",
        "credit": "Ikiwaner",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Luzern_Kapellbruecke.jpg",
        "license": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
    },
    {
        "id": "chapel-interior",
        "alt": "The timber-covered walkway inside Chapel Bridge",
        "credit": "Tisc5027",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Kapellbr%C3%BCcke,_Luzern.png",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    },
]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    ort.disable_telemetry_events()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "dist/experiments/depth/assets")
    args = parser.parse_args()
    model_path = args.model_dir / "model_q4.onnx"
    for filename, expected in MODEL_SHA256.items():
        if sha256(args.model_dir / filename) != expected:
            raise ValueError("Model file does not match the pinned revision: " + filename)
    config = json.loads((args.model_dir / "preprocessor_config.json").read_text())
    args.output.mkdir(parents=True, exist_ok=True)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    session = ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    print("Model ready:", session.get_inputs()[0].shape, flush=True)
    mean = np.asarray(config["image_mean"], dtype=np.float32)
    std = np.asarray(config["image_std"], dtype=np.float32)
    samples = []
    for source in SAMPLES:
        name = source["id"]
        original = ROOT / "dist/assets/places" / (name + ".webp")
        image_path = args.output / (name + ".webp")
        # Existing public derivatives are already below 1600px. Copy bytes to
        # preserve the credited source, its framing, and the artist watermark.
        image = Image.open(original).convert("RGB")
        if max(image.size) > 1600:
            raise ValueError("Public source exceeds the reviewed demo size")
        shutil.copyfile(original, image_path)
        width, height = image.size
        scale = max(config["size"]["width"] / width, config["size"]["height"] / height)
        multiple = config["ensure_multiple_of"]
        model_width = round(width * scale / multiple) * multiple
        model_height = round(height * scale / multiple) * multiple
        model_image = image.resize((model_width, model_height), Image.Resampling.BICUBIC)
        pixels = np.asarray(model_image).astype(np.float32) * config["rescale_factor"]
        pixels = ((pixels - mean) / std).transpose(2, 0, 1)[None].copy()
        started = time.perf_counter()
        prediction = np.asarray(session.run(None, {input_name: pixels})[0]).squeeze()
        elapsed = round(time.perf_counter() - started, 3)
        if not np.all(np.isfinite(prediction)) or prediction.max() <= prediction.min():
            raise ValueError("Depth inference returned invalid or constant data")
        normalized = (prediction - prediction.min()) / (prediction.max() - prediction.min())
        depth = Image.fromarray(np.round(normalized * 255).astype(np.uint8), mode="L")
        depth_size = (round(width * 518 / max(width, height)), round(height * 518 / max(width, height)))
        depth = depth.resize(depth_size, Image.Resampling.BICUBIC)
        depth_path = args.output / (name + "-depth.png")
        depth.save(depth_path, optimize=True)
        record = {
            **source,
            "image": image_path.name,
            "depth": depth_path.name,
            "width": width,
            "height": height,
            "depthWidth": depth_size[0],
            "depthHeight": depth_size[1],
            "imageBytes": image_path.stat().st_size,
            "depthBytes": depth_path.stat().st_size,
            "imageSha256": sha256(image_path),
            "depthSha256": sha256(depth_path),
            "model": MODEL,
            "modelRevision": REVISION,
            "modelFile": model_path.name,
            "inferenceSeconds": elapsed,
            "inferenceInput": [model_width, model_height],
            "changes": "Previously resized to WebP; unchanged public photo copied; AI-estimated relative depth generated and resized to 518px maximum edge. Motion is a browser rendering of these derivatives.",
        }
        samples.append(record)
        print(name, "inference", elapsed, "seconds;", record["imageBytes"], "+", record["depthBytes"], "bytes", flush=True)
    manifest = {
        "schemaVersion": 1,
        "generatedDate": "2026-10-14",
        "purpose": "Public illustrative fullscreen depth-motion demo; not traveler photographs or trip memories.",
        "depthConvention": "Normalized relative inverse depth: black=far, white=near; not metric distance.",
        "model": {
            "id": MODEL,
            "revision": REVISION,
            "sourceUrl": "https://huggingface.co/" + MODEL + "/tree/" + REVISION,
            "baseModel": "depth-anything/Depth-Anything-V2-Small",
            "license": "Apache-2.0",
            "precision": "q4",
            "runtime": "onnxruntime " + ort.__version__,
            "provider": "CPUExecutionProvider",
            "files": {p.name: {"bytes": p.stat().st_size, "sha256": sha256(p)} for p in [model_path, args.model_dir / "model_q4.onnx_data", args.model_dir / "preprocessor_config.json"]},
        },
        "samples": samples,
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
