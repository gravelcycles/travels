# Public depth-demo assets

Prepared 14 October 2026 for the owner's remotely accessible fullscreen-motion
experiment. These are public illustrative photographs already used in the
Alpine Crossing demo. They are not traveler photographs, personal memories,
evidence of a trip visit, or a change to a journey's photo manifest.

| Demo pair | Photographer and source | License applying to photo and derived depth/motion |
| --- | --- | --- |
| `chapel-bridge.webp`, `chapel-bridge-depth.png` | Ikiwaner, [Luzern Kapellbruecke.jpg](https://commons.wikimedia.org/wiki/File:Luzern_Kapellbruecke.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `chapel-interior.webp`, `chapel-interior-depth.png` | Tisc5027, [Kapellbrücke, Luzern.png](https://commons.wikimedia.org/wiki/File:Kapellbr%C3%BCcke,_Luzern.png) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

The photographs are byte-identical copies of the existing public derivatives
under `dist/assets/places/`, at a 1440 px maximum edge. The prior WebP conversion
is retained; no crop, watermark removal or generated photo content is added.
Each new depth PNG is inferred from that exact photograph, normalized and
resized to a 518 px maximum edge. Interactive motion is an adaptation rendered
from those assets. Retain attribution, source/license links, and this change
notice in the public experiment. The source pages and licenses were checked on
14 October 2026.

## Actual depth estimation

Depth maps use [Depth Anything V2 Small](https://huggingface.co/depth-anything/Depth-Anything-V2-Small),
the Apache-2.0 model, via the [ONNX Community export](https://huggingface.co/onnx-community/depth-anything-v2-small-ONNX/tree/c3b67641fd837b2368757101311e5d21e511441e)
pinned to revision `c3b67641fd837b2368757101311e5d21e511441e`. The local generator
uses the q4 weights and ONNX Runtime's CPU execution provider. The model is
not copied into the site and visitors download no inference runtime or weights.

The generator follows the pinned processor's RGB normalization, bicubic resize
and 14-pixel size multiple, with the shorter input edge at least 518 px. Output
is normalized relative inverse depth: **black is far, white is near**. It is
estimated scene structure, not metric distance or a luminance-based fake depth
map. Thin railings, reflected water, sky boundaries, and disoccluded areas may
still distort when motion exposes content absent from the original photograph.
The walkway intentionally adds a portrait example and a strong vanishing point.

`dist/experiments/depth/assets/manifest.json` records the exact input/output sizes,
SHA-256 hashes, pinned model hashes, processor input sizes, runtime and local
inference duration. These machine-specific durations are not browser performance
claims. Public image/depth artifacts can be independently checked against it.

The generated pairs were visually checked and their hashes verified on
14 October 2026. The bridge depth resolves the near water, bridge and tower
against a distant skyline; the interior resolves the walkway's vanishing point
and nearer framing timbers. Both maps contain over 250 distinct gray values.

| Sample | Public photo | Additional depth | Local CPU inference |
| --- | --- | --- | --- |
| Bridge exterior | 1440 × 960; 192,794 bytes | 518 × 345; 16,224 bytes | 1.426 s |
| Covered walkway | 887 × 1440; 156,600 bytes | 319 × 518; 23,291 bytes | 1.374 s |

The two depth maps add 39,515 bytes total. Actual initial/interactive transfer
depends on the demo's loading policy and browser cache. The full q4 model graph
and weights total 27,625,582 bytes locally; they are excluded from deployment.

## Reproduce locally

Use an isolated Python environment with NumPy, Pillow and ONNX Runtime. The
model and downloaded dependencies belong outside the repository, for example
under `/private/tmp/travels-depth-model/`; only the small public derivatives,
manifest and generator are tracked. Download these three files from the pinned
ONNX export above into the same model directory:

- `onnx/model_q4.onnx` (159,342 bytes)
- `onnx/model_q4.onnx_data` (27,466,240 bytes)
- `preprocessor_config.json`

The recorded run used Python 3.12.14, NumPy 2.3.5, Pillow 12.3.0 and ONNX Runtime
1.31.0. The generator verifies each model/config SHA-256 before inference.

From the repository root run:

```sh
python scripts/experiments/depth/generate-assets.py --model-dir /private/tmp/travels-depth-model
```

The script accepts only its two explicit public source paths. It does not scan
traveler media, change source images or upload anything. Numerical library
versions can cause minor inference/PNG differences; use the recorded runtime
and verify the actual result rather than assuming byte identity after rerunning.

This demo does not authorize future private-photo derivatives to be public.
A production depth map derived from protected photo pixels must inherit the
same authenticated storage, delivery and cleanup policy as that photograph.
