import fs from 'node:fs';

// Small excerpt of the current OpenFreeMap Liberty style, captured 2026-09-10.
export const libertyLabels = JSON.parse(fs.readFileSync(new URL('./fixtures/liberty-labels.json', import.meta.url)));
export function mapStyleHarness(initial = libertyLabels) {
  let layers = structuredClone(initial);
  return {
    getStyle: () => ({ layers: structuredClone(layers) }),
    getLayer: id => layers.find(l => l.id === id),
    setLayoutProperty(id, key, value) { (this.getLayer(id).layout ||= {})[key] = structuredClone(value); },
    setPaintProperty(id, key, value) { (this.getLayer(id).paint ||= {})[key] = structuredClone(value); },
    moveLayer(id) { const layer = this.getLayer(id); layers = layers.filter(l => l.id !== id); layers.push(layer); },
    addSource() {},
    addLayer(layer, before) {
      const index = before ? layers.findIndex(l => l.id === before) : layers.length;
      if (index < 0) throw new Error(`Missing layer ${before}`);
      layers.splice(index, 0, layer);
    }
  };
}
