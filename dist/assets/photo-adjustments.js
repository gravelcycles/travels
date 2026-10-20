(function (root) {
  'use strict';
  const fullCrop = () => ({x:0,y:0,width:1,height:1});
  const normalizeRotation = value => ((value + 180) % 360 + 360) % 360 - 180;
  function validRecipe(value) {
    const c = value?.crop;
    return !!c && Number.isFinite(value.rotation) && Math.abs(value.rotation) <= 180
      && [c.x,c.y,c.width,c.height].every(Number.isFinite) && c.x >= 0 && c.y >= 0
      && c.width > 0 && c.height > 0 && c.x+c.width <= 1.00000001 && c.y+c.height <= 1.00000001;
  }
  // Straighten inside a fitted rectangle, trimming the empty rotated corners.
  // Quarter turns retain all pixels. Crop coordinates refer to this safe frame.
  function frame(width, height, rotation) {
    const quarter = Math.round(rotation/90), angle = (rotation-quarter*90)*Math.PI/180;
    const w = Math.abs(quarter%2) ? height : width, h = Math.abs(quarter%2) ? width : height;
    const scale = Math.max(Math.cos(angle)+h/w*Math.abs(Math.sin(angle)),Math.cos(angle)+w/h*Math.abs(Math.sin(angle)));
    return {width:w/scale,height:h/scale};
  }
  function presetCrop(width, height, ratio) {
    if (!ratio) return fullCrop();
    const aspect = width/height;
    const w = Math.min(1,ratio/aspect), h = Math.min(1,aspect/ratio);
    return {x:(1-w)/2,y:(1-h)/2,width:w,height:h};
  }
  const webp = /^\/private-photos\/assets\/v1\/[a-f0-9]{64}\.webp$/;
  function validAssets(a) {
    return !!a && Object.keys(a).every(key=>['src','srcset','width','height','blur','protected','assetStatus'].includes(key))
      && webp.test(a.src || '') && a.protected === true && ['local','published'].includes(a.assetStatus)
      && [a.width,a.height].every(n=>Number.isSafeInteger(n)&&n>0) && a.width*a.height <= 100_000_000
      && typeof a.blur === 'string' && a.blur.length < 20000 && /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(a.blur)
      && Array.isArray(a.srcset) && a.srcset.length > 0 && a.srcset.length <= 3
      && a.srcset.every(v=>webp.test(v.src || '') && [v.width,v.height,v.bytes].every(n=>Number.isSafeInteger(n)&&n>0) && v.bytes<=16*1024*1024)
      && a.srcset.some(v=>v.src===a.src&&v.width===a.width&&v.height===a.height);
  }
  function validEdit(edit, photo) {
    return edit === null || (!edit?.pending && validRecipe(edit) && edit.sourceSrc === photo.src && validAssets(edit.assets)
      && (!edit.publishedAssets || (validAssets(edit.publishedAssets) && edit.publishedAssets.assetStatus === 'published')));
  }
  function publicOverride(override) {
    if (!override.imageEdit) return override;
    const {imageEdit,...rest} = override;
    const assets = imageEdit.assets.assetStatus === 'published' ? imageEdit.assets : imageEdit.publishedAssets;
    return assets ? {...rest,imageEdit:{assets:{...assets}}} : rest;
  }
  root.JOURNEY_ATLAS_PHOTO_ADJUSTMENTS = {fullCrop,normalizeRotation,validRecipe,frame,presetCrop,validAssets,validEdit,publicOverride};
})(typeof window === 'undefined' ? globalThis : window);
