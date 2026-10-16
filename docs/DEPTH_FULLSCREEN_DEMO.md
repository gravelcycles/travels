# Fullscreen depth-motion preview — 14 October 2026

The owner requested a remotely accessible demonstration inspired by
[DepthFlow](https://github.com/BrokenSource/DepthFlow), initially off and available
in fullscreen, before deciding whether to integrate it. **Only the standalone
demo is authorized.** The shared journey viewer, templates and trip photo
manifests are outside this change. Publication of this review artifact is
explicitly requested; it is an exception to keeping unrequested prototypes local.
The 15 October correction authorizes seven existing website photographs in this
demo, with their depth derivatives kept behind normal existing photo access.

Review URL: <https://gravelcycles.github.io/travels/experiments/depth/>.
The gentle revision is live with the two public examples. All seven protected
depth maps were published and verified in private R2 on 16 October. The updated
Pages manifest and live nine-photo checks remain pending, so the additions are
not yet offered on the remote page.
Open a sample, then turn on **Depth motion**. **Drag** is the
default: mouse/one-finger drags move the viewpoint in two axes, release holds it,
and **Reset view** centers it. Hover alone does not move the photo in Drag mode.
Choose **Mouse move** for pointer steering without a held button, or **Slow
drift** for automatic motion. Dragging during another mode takes control without
jumping to an absolute pointer position.
The focused photo accepts arrow keys (Shift for larger steps) and Home to reset;
arrows outside it retain photo navigation. Multi-touch/native pinch, cancellation,
blur, resize, mode changes and dismissal release any captured drag.

**Movement** spans 0–100%, starting at 100% of the original gentle motion.
Zero shows the uncropped/unwarped original. The slider can reduce movement but
cannot exceed that gentle range; the former 3× presets are removed. This is
relative parallax strength, not measured scene depth. Movement remains editable
while paused; **Hold for original** shows the uncropped source. The level persists
while trying another sample in the same page, but the effect itself starts off
for each newly selected photo and every reopened viewer. No preference is saved
across reload. Deliberately selected Slow drift has Pause/Resume. Reduced motion
uses direct drag with no automatic drift or easing; explicitly choosing drift is
still possible. Motion stops when off, flat, closed, paused/settled or backgrounded.
WebGL/asset failure retains the still image. Native device fullscreen is optional;
the modal already fills the browser on devices without that API.

**Owner correction, 15 October:** the stronger effect was too extreme; return
to gentle motion while keeping drag and mouse interaction, and add seven website
photographs. This supersedes the 14 October request for more dramatic adjustable
3D and its 0–3× range/presets. It retains the useful direct-drag interaction and
does not authorize shared-viewer integration. Delivery status and verification
of this revision remain in [WIP](../WIP.md#fullscreen-depth-motion-preview--14-october-2026).

This is a visual interaction prototype, not a replacement gallery. It does not
implement the atlas's swipe/pinch, map return or event navigation. It reuses the
existing private-photo access for the seven protected samples. All established
gallery flows must stay intact if a later integration is approved.

## Sample access

The requested set is nine photographs: the two existing public Wikimedia Commons
examples and seven existing website photographs. The public samples retain their
attributions and work without unlocking photos. The seven website photographs
and their inferred depth use private R2 and the same authenticated gateway as
the atlas, with normal remembered access and unlock recovery. There is no
separate demo credential or public fallback for protected pixels. Until their
private upload is verified, unpublished samples are hidden on remote hosts;
localhost review can exercise the prepared derivatives. The normal auth client
loads only when protected samples are available. A failed auth-client load
retains the public examples.

Protected thumbnails, full images and depth maps must not be copied into the
public experiment directory, manifest or encoded previews. The demo may refer
to their asset IDs; only authorized requests obtain their pixels. Load depth
only after explicit activation, keep it within the existing bounded media
lifecycle, and clear protected images/textures/object URLs when access expires
or is revoked. Failed unlock or asset loads retain a usable locked/still state.
The exact selected photos, hashes, private publication and generation evidence
belong in [DEPTH_DEMO_ASSETS.md](DEPTH_DEMO_ASSETS.md); ordinary access remains
governed by [PHOTO_AUTH_HANDOFF.md](../PHOTO_AUTH_HANDOFF.md).

## Processing choice

DepthFlow is a Python/PyTorch/ShaderFlow application, not a drop-in browser
package. It accepts a supplied depth map and renders using GLSL. This preview
uses an independently written WebGL parallax-occlusion shader; no DepthFlow code
is copied and this is not an official browser port.

Recommended atlas pipeline, subject to later approval:

1. Estimate a depth map once during local photo preparation with Depth Anything
   V2 Small. Review motion quality; skip photos with unreliable depth.
2. Publish that derivative under the **same private access boundary** as the
   source photograph. Depth maps can reveal scene structure; do not make private
   ones public or include them in public data bundles.
3. Lazy-load the map only when a viewer deliberately enables the effect. Render
   small camera movement on-device, keeping the still underneath until ready.
   No pre-rendered video is necessary. Cache/dispose within existing bounded
   media lifecycles and clear protected pixels at authentication expiry.

Browser-only depth inference is technically possible through Transformers.js /
ONNX Runtime (CPU/WASM or WebGPU). It adds model download, memory use and an
initial wait. For reference the older Small ONNX export's q8 model alone is
27.3 MB; fp32 is 99.1 MB, before the runtime. Capability and speed vary by device.
This preview deliberately measures the simpler precomputed-depth path, not
in-browser AI inference. Neither mobile performance nor inference latency is
promised without representative physical-device measurements.

Depth estimates are relative, not measured geometry. They cannot reconstruct
hidden pixels. The gentle revision caps the ray at ±0.0234 horizontally and
±0.0117 vertically at 100% Movement. The normalized level is 0–1; framing uses
`1 + 0.075 * activation * level`, reaching 1.075× zoom at full activation and
100% Movement. Framing stays constant while dragging at a fixed level, so the
view does not pump its zoom. Zero movement is uncropped/unwarped. This restores
the original gentle envelope and supersedes the stronger 14 October settings.
Thin structures, reflections and depth boundaries can still stretch because
the source photograph contains no hidden background pixels.
The shader uses 96 coarse samples plus six refinements. The WebGL canvas is capped
at 1.4 million pixels and device pixel ratio 1.5. No video encoder, server GPU,
visitor uploads, tracking or external model request is involved in playback.

## Source and verification

- HTML source: `prototypes/depth/index.html`; the ordinary build emits
  `dist/experiments/depth/index.html`.
- Demo-only runtime/style: `dist/experiments/depth/`. Nothing in the journey
  template or catalog imports or links to the preview.
- The build content-hashes the demo runtime/style, renderer and sample manifest together. The
  lazy renderer import and manifest request carry that version, so returning visitors fetch matching
  code when the remote preview changes.
- Image/model provenance and reproducible generation:
  [DEPTH_DEMO_ASSETS.md](DEPTH_DEMO_ASSETS.md) and the public sample manifest.
- Delivery evidence and exact remaining scope: [WIP](../WIP.md#fullscreen-depth-motion-preview--14-october-2026).

The original two public samples add 16,224 / 23,291 bytes of depth, with
approximately 1.4 seconds of local CPU inference per photo once the model was
loaded. These 14 October measurements do not cover the seven new protected
samples; their actual results belong in the asset record. No local preparation
timing is a claim about browser inference or all photos.

Browser checks are reproducible with
`node scripts/experiments/depth/check-browser.mjs`; install Playwright or set
`DEPTH_PLAYWRIGHT_MODULE` to its module, and optionally `CHROME_EXECUTABLE` to an
installed Chrome. The script serves the public build on an ephemeral localhost
port. Set `DEPTH_PRIVATE_ASSET_DIR` to the ignored local private-assets `v1`
directory for all-nine checks: the script uses the actual selected photos/maps,
mock credentials and the real auth helper, intercepting authorized fixture
requests without serving private files publicly or contacting the live gateway.
The integrated 16 October release passes all 678 tests and the production build.
Actual-asset checks cover gentle controls,
all nine samples, login returns/history, failed-map retry, expiry/lock cleanup,
stale private loads and absence of protected pixels in public output. Current
release evidence remains in WIP. The 16 October private publisher separately
verified all seven remote depth objects, the existing photos/thumbnails and
anonymous 401/no-store rejection; its receipt is in the asset record. Local
all-nine browser fixtures passed again that day. Pages delivery is still pending.

Before any subsequent delivery, run the full suite/build and check desktop, phone/landscape,
initial off state, lazy depth loading, on/off, all nine photos, comparison,
relative mouse/touch drag, hover/release hold in Drag mode, Mouse move steering,
reset/keyboard, 0/50/100% Movement and the gentle maximum, pause, capture
cancellation, close/reopen, rapid changes, reduced motion, unavailable WebGL and
failed depth requests. Verify anonymous protected-photo/depth rejection,
authenticated checksums, remembered access, expiry cleanup and the absence of
protected pixels in public output. Check public assets and the live protected
sample flow after the successful Pages deployment.
Physical iOS Safari/Android GPU performance remains an integration acceptance
check. If approved, implement once in the existing shared fullscreen viewer and
verify the reference, a demo and an independently populated fresh draft.

## Primary references

- [DepthFlow package dependencies](https://github.com/BrokenSource/DepthFlow/blob/main/pyproject.toml)
  and [scene pipeline](https://github.com/BrokenSource/DepthFlow/blob/main/depthflow/scene.py).
- [Transformers.js](https://huggingface.co/docs/transformers.js/index) and
  [WebGPU guide](https://huggingface.co/docs/transformers.js/guides/webgpu).
- [Small ONNX model files](https://huggingface.co/onnx-community/depth-anything-v2-small/tree/main/onnx).
- [Depth Anything V2 usage and licenses](https://github.com/DepthAnything/Depth-Anything-V2#license):
  Small is Apache-2.0; larger variants have different terms.
- [DepthFlow license](https://github.com/BrokenSource/DepthFlow/blob/main/license.txt):
  upstream is AGPL-3.0; a future direct port must preserve applicable terms.
