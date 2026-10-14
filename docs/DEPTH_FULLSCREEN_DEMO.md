# Fullscreen depth-motion preview — 14 October 2026

The owner requested a remotely accessible demonstration inspired by
[DepthFlow](https://github.com/BrokenSource/DepthFlow), initially off and available
in fullscreen, before deciding whether to integrate it. **Only the standalone
demo is authorized.** The shared journey viewer, templates, photo manifests and
private photo service are unchanged. Publication of this review artifact is
explicitly requested; it is an exception to keeping unrequested prototypes local.

Review URL: <https://gravelcycles.github.io/travels/experiments/depth/>.
Open either sample, then turn on **Depth motion**. Slow drift, pointer/touch
steering, movement strength, pause and hold-for-original support comparison.
Each newly selected photo and every reopened viewer starts off. Reduced motion
selects pointer mode with no automatic drift; deliberate selection of Slow drift
remains available. Motion stops when off, closed, paused/settled or backgrounded.
WebGL/asset failure retains the still image. Native device fullscreen is optional;
the modal already fills the browser on devices without that API.

This is a visual interaction prototype, not a replacement gallery. It does not
implement the atlas's swipe/pinch, map return, event navigation or private unlock
flows. Those must stay intact if a later integration is approved.

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
hidden pixels. Small motion and 7.5% overscan limit exposed edges; thin structures,
reflections and depth boundaries can still stretch. The WebGL canvas is capped
at 1.4 million pixels and device pixel ratio 1.5. No video encoder, server GPU,
visitor uploads, tracking or external model request is involved in playback.

## Source and verification

- HTML source: `prototypes/depth/index.html`; the ordinary build emits
  `dist/experiments/depth/index.html`.
- Demo-only runtime/style: `dist/experiments/depth/`. Nothing in the journey
  template or catalog imports or links to the preview.
- Image/model provenance and reproducible generation:
  [DEPTH_DEMO_ASSETS.md](DEPTH_DEMO_ASSETS.md) and the public sample manifest.
- Delivery evidence and exact remaining scope: [WIP](../WIP.md#fullscreen-depth-motion-preview--14-october-2026).

The sample depth overhead is 16,224 / 23,291 bytes, with approximately 1.4 seconds
of local CPU inference per photo once the model is loaded. These are local
preparation measurements, not claims about browser inference or all photos.

Browser checks are reproducible with
`node scripts/experiments/depth/check-browser.mjs`; install Playwright or set
`DEPTH_PLAYWRIGHT_MODULE` to its module, and optionally `CHROME_EXECUTABLE` to an
installed Chrome. The script serves only public output on an ephemeral localhost
port and never accesses private media. The 640-test suite, build and browser
checks pass. Desktop/phone/landscape screenshot inspection also passed.

Before any subsequent delivery, run the full suite/build and check desktop, phone/landscape,
initial off state, lazy depth loading, on/off, both photos, comparison, pointer,
pause, close/reopen, rapid changes, reduced motion, unavailable WebGL and a failed
depth request. Check public assets after the successful Pages deployment.
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
