#!/usr/bin/env python3
"""Generate the two public and seven protected review-demo depth maps.

Run in an isolated environment with numpy, Pillow and onnxruntime installed.
See docs/DEPTH_DEMO_ASSETS.md for pinned model downloads and reproduction.
"""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import time
from io import BytesIO
import re

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
JOURNEY = "backpacking-europe-heading-east"
PRIVATE_PREFIX = "/private-photos/assets/v1/"
PRIVATE_PHOTO_IDS = [
    "backpacking-europe-heading-east-upload-cb7a62b4305fd9464031",
    "backpacking-europe-heading-east-upload-089d06cf9fc8eb426463",
    "backpacking-europe-heading-east-snapseed-camera-capture-20260926-162050-471",
    "backpacking-europe-heading-east-upload-0c9ecf49de2111a7051c",
    "backpacking-europe-heading-east-upload-d90b1f16a88de07cee13",
    "backpacking-europe-heading-east-upload-063e6cbbb7fe4d1371a3",
    "backpacking-europe-heading-east-img-3520",
]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def private_sources():
    photos = {}
    for suffix in ["", "-uploads"]:
        for photo in json.loads((ROOT / f"content/photo-manifests/{JOURNEY}{suffix}.json").read_text()):
            photos[photo["id"]] = photo
    overrides = json.loads((ROOT / "content/photo-overrides.json").read_text())
    sources = []
    for number, photo_id in enumerate(PRIVATE_PHOTO_IDS, 1):
        photo = photos[photo_id]
        override = overrides.get(photo_id, {})
        if not photo.get("protected") or photo.get("assetStatus") != "published" or override.get("trashed"):
            raise ValueError("Selected photo is no longer eligible: " + photo_id)
        variants = sorted(photo["srcset"], key=lambda item: item["width"])
        image = next(item["src"] for item in variants if item["width"] >= 1280)
        thumbnail = next(item["src"] for item in variants if item["width"] >= 480)
        day_id = override.get("dayId", photo["dayId"])
        sources.append({
            "id": f"east-{number:02d}", "protected": True,
            "sourcePhotoId": photo_id, "journeyId": JOURNEY,
            "image": image, "thumbnail": thumbnail,
            "alt": override.get("alt", photo.get("alt")) or f"Photo {number}",
            "credit": "Trip photograph", "license": "Private photo",
            "sourceUrl": f"https://gravelcycles.github.io/travels/{JOURNEY}.html#day={day_id}&photo={photo_id}&view=photo",
            "takenAt": photo.get("takenAt", ""),
        })
    return sources


def main():
    ort.disable_telemetry_events()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--private-source-root", type=Path, required=True,
                        help="Checkout whose ignored build/private-photo-assets/v1 contains the existing photographs and receives protected depth WebPs")
    parser.add_argument("--output", type=Path, default=ROOT / "dist/experiments/depth/assets")
    args = parser.parse_args()
    private_dir = args.private_source_root.resolve() / "build/private-photo-assets/v1"
    if "dist" in private_dir.parts or not (args.private_source_root / "AGENTS.md").is_file():
        raise ValueError("Protected derivatives must remain outside public output")
    previous_manifest = args.output / "manifest.json"
    previous = {sample["id"]: sample for sample in json.loads(previous_manifest.read_text()).get("samples", [])} if previous_manifest.exists() else {}
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
    for source in SAMPLES + private_sources():
        name = source["id"]
        protected = source.get("protected", False)
        if protected and not re.fullmatch(r"/private-photos/assets/v1/[a-f0-9]{64}\.webp", source["image"]):
            raise ValueError("Invalid protected source path")
        original = private_dir / source["image"].removeprefix(PRIVATE_PREFIX) if protected else ROOT / "dist/assets/places" / (name + ".webp")
        image_path = original if protected else args.output / (name + ".webp")
        if protected and (not source["image"].startswith(PRIVATE_PREFIX) or sha256(original) != original.stem):
            raise ValueError("Protected source checksum mismatch")
        # Existing public derivatives are already below 1600px. Copy bytes to
        # preserve the credited source, its framing, and the artist watermark.
        image = Image.open(original).convert("RGB")
        if not protected and max(image.size) > 1600:
            raise ValueError("Public source exceeds the reviewed demo size")
        if not protected:
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
        if protected:
            encoded = BytesIO()
            depth.convert("RGB").save(encoded, format="WEBP", lossless=True, method=6)
            data = encoded.getvalue()
            digest = hashlib.sha256(data).hexdigest()
            depth_path = private_dir / (digest + ".webp")
            if depth_path.exists() and depth_path.read_bytes() != data:
                raise ValueError("Protected derivative hash collision")
            depth_path.parent.mkdir(parents=True, exist_ok=True)
            depth_path.write_bytes(data)
            depth_source = PRIVATE_PREFIX + depth_path.name
        else:
            depth_path = args.output / (name + "-depth.png")
            depth.save(depth_path, optimize=True)
            depth_source = depth_path.name
        record = {
            **source,
            "image": source["image"] if protected else image_path.name,
            "depth": depth_source,
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
            "changes": "Existing protected 1280px photo reused; AI-estimated relative depth generated as protected lossless WebP at 518px maximum edge." if protected else "Previously resized to WebP; unchanged public photo copied; AI-estimated relative depth generated and resized to 518px maximum edge. Motion is a browser rendering of these derivatives.",
        }
        if protected:
            old = previous.get(name, {})
            record["assetStatus"] = "published" if old.get("depth") == depth_source and old.get("assetStatus") == "published" else "local"
        samples.append(record)
        print(name, "inference", elapsed, "seconds;", record["imageBytes"], "+", record["depthBytes"], "bytes", flush=True)
    manifest = {
        "schemaVersion": 1,
        "generatedDate": "2026-10-15",
        "purpose": "Fullscreen depth-motion review: two public illustrative photographs and seven existing protected traveler photographs; all traveler pixels and depth remain authenticated.",
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
