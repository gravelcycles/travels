# Depth-demo assets and protected derivatives

Prepared 14 October 2026 for the owner's remotely accessible fullscreen-motion
experiment; expanded 15 October after the owner requested seven more photos
from the website. The original two public illustrative photographs remain.
The seven additions are existing published Heading East photographs and keep
the site's normal authentication for thumbnails, images **and depth maps**.
This adds no journey integration and changes no journey photo manifest.

## Two public illustrative photographs

These Alpine Crossing samples are not traveler photographs, personal memories
or evidence of a trip visit.

| Demo pair | Photographer and source | License applying to photo and derived depth/motion |
| --- | --- | --- |
| `chapel-bridge.webp`, `chapel-bridge-depth.png` | Ikiwaner, [Luzern Kapellbruecke.jpg](https://commons.wikimedia.org/wiki/File:Luzern_Kapellbruecke.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `chapel-interior.webp`, `chapel-interior-depth.png` | Tisc5027, [Kapellbrücke, Luzern.png](https://commons.wikimedia.org/wiki/File:Kapellbr%C3%BCcke,_Luzern.png) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

The photographs are byte-identical copies of the existing public derivatives
under `dist/assets/places/`, at a 1440 px maximum edge. The prior WebP conversion
is retained; no crop, watermark removal or generated photo content is added.
Each public depth PNG is inferred from that exact photograph, normalized and
resized to a 518 px maximum edge. Interactive motion is an adaptation rendered
from those assets. Retain attribution, source/license links, and this change
notice in the public experiment. The source pages and licenses were checked on
14 October 2026.

## Seven existing protected photographs — 15 October 2026

The owner asked to add seven more photos from the website while returning the
motion to gentle intensity and keeping mouse/drag controls. The selected
photographs already have `protected: true` and `assetStatus: "published"` in
the Heading East base/upload manifests; none is trashed. Their existing 1280 px
image and 480 px thumbnail objects are reused without copying or republishing
the photograph. The selection spans three landscape and four portrait frames.
Only existing accessibility text and real capture labels are carried forward;
no caption, venue association or inferred location is added.

| Demo ID | Existing photo ID suffix after `backpacking-europe-heading-east-` | Capture label |
| --- | --- | --- |
| `east-01` | `upload-cb7a62b4305fd9464031` | 2026-08-30 · 14:41 |
| `east-02` | `upload-089d06cf9fc8eb426463` | 2026-09-03 · 20:15 |
| `east-03` | `snapseed-camera-capture-20260926-162050-471` | 2026-09-26 · 16:20 |
| `east-04` | `upload-0c9ecf49de2111a7051c` | 2026-10-02 · 16:44 |
| `east-05` | `upload-d90b1f16a88de07cee13` | 2026-10-04 · 13:50 |
| `east-06` | `upload-063e6cbbb7fe4d1371a3` | 2026-10-06 · 16:40 |
| `east-07` | `img-3520` | 2026-10-09 · 14:45 |

The generated depth is a metadata-stripped lossless WebP with a 518 px maximum
edge. It uses the existing immutable `/private-photos/assets/v1/<sha256>.webp`
namespace and private R2 bucket. The public demo manifest includes protected
paths, dimensions, hashes and source-photo links, never protected image/depth
pixels or credentials. `license: "Private photo"` is an access label, not a
reuse license. Local private derivatives stay under ignored
`build/private-photo-assets/v1/` in the explicitly supplied source checkout.

The bounded publisher validates the seven source photographs' eligibility,
checks all local hashes and metadata, verifies public bucket access is disabled
and account storage has room under the existing 9 GB preflight ceiling, then
uploads only missing depth objects. Existing photo/thumbnail bytes are verified
but never uploaded or overwritten. Every remote object is checksum-verified;
anonymous gateway HEAD requests must return 401/no-store. Only after all checks
pass are the seven manifest records marked `assetStatus: "published"`.
The normal photo-auth loader owns access, expiry and pixel cleanup in the demo.
Remote hosts hide protected records until that verified publication status is set;
localhost review can exercise all nine prepared samples.

The website's other venue images remain external linked references. No new
redistribution license was inferred from their being visible on the website.

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

The 15 October regeneration retained all four public image/depth files byte for
byte. The seven additional protected maps total **183,664 bytes**; image and
thumbnail objects are reused. Local CPU inference took 0.797–1.085 seconds per
added photograph. Every private map has 255 or 256 distinct gray values and
was visually checked against its exact source photograph. All nine image/depth
hashes, dimensions and byte counts match the generated manifest. The local
publisher dry run passed for the seven selected photographs and seven depth
objects.

On **16 October 2026**, restored Wrangler authorization allowed the bounded
publisher to upload and checksum-verify all seven depth objects. It also verified
the 14 existing image/thumbnail objects without republishing them, confirmed
public R2 access was disabled, and recorded 327,914,048 account-storage bytes
before the upload, below the existing ceiling. All seven anonymous gateway HEAD
requests returned **401/no-store**. Only then were the seven demo records marked
`assetStatus: "published"`. The updated Pages manifest and live nine-photo
verification remain pending; private R2 publication alone does not make the
additional samples available on the remote review page.

| Protected sample | Depth size | Additional bytes | Local CPU inference |
| --- | --- | --- | --- |
| `east-01` | 518 × 388 | 18,828 | 1.085 s |
| `east-02` | 388 × 518 | 23,868 | 0.797 s |
| `east-03` | 518 × 388 | 13,622 | 0.806 s |
| `east-04` | 388 × 518 | 27,936 | 0.800 s |
| `east-05` | 388 × 518 | 44,352 | 0.862 s |
| `east-06` | 388 × 518 | 27,618 | 0.899 s |
| `east-07` | 518 × 388 | 27,440 | 0.869 s |

## Reproduce locally

Use an isolated Python environment with NumPy, Pillow and ONNX Runtime. The
model and downloaded dependencies belong in ignored local storage. The earlier
`/private/tmp` cache was cleared before resumption; the current retained setup is
`/Users/dg/code/travels/build/depth-tools/{model,runtime}`. Only public derivatives,
the path-only manifest and generation/publishing scripts are tracked. Download these three files from the pinned
ONNX export above into the same model directory:

- `onnx/model_q4.onnx` (159,342 bytes)
- `onnx/model_q4.onnx_data` (27,466,240 bytes)
- `preprocessor_config.json`

The recorded run used Python 3.12.14, NumPy 2.3.5, Pillow 12.3.0 and ONNX Runtime
1.31.0. The generator verifies each model/config SHA-256 before inference.

From the repository root run:

```sh
python scripts/experiments/depth/generate-assets.py \
  --model-dir /Users/dg/code/travels/build/depth-tools/model \
  --private-source-root /Users/dg/code/travels
```

The script accepts only two explicit public source paths and seven explicitly
selected published photo IDs. It requires the private source checkout, validates
source hashes and writes private depth only to its ignored private-assets folder.
It does not scan originals, change source photographs or upload anything. Numerical library
versions can cause minor inference/PNG differences; use the recorded runtime
and verify the actual result rather than assuming byte identity after rerunning.

Run the demo publisher from the source checkout that has the existing Wrangler
authorization and dependencies; use the actual worktree script path:

```sh
node build/depth-gentle-review/scripts/experiments/depth/publish-depth-assets.mjs \
  --source-root /Users/dg/code/travels
node build/depth-gentle-review/scripts/experiments/depth/publish-depth-assets.mjs \
  --source-root /Users/dg/code/travels --publish
```

The first command is a local dry run. The second uses the existing Cloudflare
authorization, does not display credentials and preserves immutable existing
objects. Authentication failure leaves publication status unchanged; restore
Wrangler authorization through its existing browser flow before retrying.
This bounded seven-photo experiment does not authorize bulk processing or public
distribution of private-photo derivatives. Any later integration inherits the
same authenticated storage, delivery and cleanup policy.
