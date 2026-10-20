(function (root) {
  'use strict';
  function create({getContext,setEdit,refresh}) {
    const model=root.JOURNEY_ATLAS_PHOTO_ADJUSTMENTS, dialog=document.querySelector('#photo-adjust-dialog');
    const $=s=>dialog.querySelector(s), canvas=$('canvas'), stage=$('.adjust-stage'), box=$('.adjust-crop');
    let photo,journeyId,recipe,image,loaded=false,busy=false,drag=null,version=0;
    const round=n=>Math.round(n*1000000)/1000000;
    const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
    function status(message) { $('[data-adjust-status]').textContent=message; }
    function validAngle() { const raw=$('#adjust-degrees').value.trim(); return raw!=='' && Number.isFinite(Number(raw)) && Math.abs(Number(raw))<=180; }
    function capture() {
      const previous=getContext().state.photos[photo.id]?.imageEdit;
      setEdit(photo.id,{...previous,...recipe,rotationInput:$('#adjust-degrees').value,sourceSrc:photo.src,pending:true});
    }
    function draw() {
      if (!loaded) return;
      const f=model.frame(image.naturalWidth,image.naturalHeight,recipe.rotation);
      const scale=Math.min(1,1100/f.width,680/f.height);
      canvas.width=Math.round(f.width*scale);canvas.height=Math.round(f.height*scale);
      stage.style.width=`min(100%, ${33*f.width/f.height}dvh)`;
      const ctx=canvas.getContext('2d');ctx.translate(canvas.width/2,canvas.height/2);
      ctx.rotate(recipe.rotation*Math.PI/180);ctx.scale(scale,scale);
      ctx.drawImage(image,-image.naturalWidth/2,-image.naturalHeight/2);
      const c=recipe.crop;
      Object.assign(box.style,{left:`${c.x*100}%`,top:`${c.y*100}%`,width:`${c.width*100}%`,height:`${c.height*100}%`});
      for (const key of ['x','y','width','height']) {
        const field=$(`[data-crop-field="${key}"]`);
        if (document.activeElement!==field) field.value=(c[key]*100).toFixed(1);
      }
      const outputW=Math.max(1,Math.floor(f.width*c.width)),outputH=Math.max(1,Math.floor(f.height*c.height));
      const outputScale=Math.min(1,3200/Math.max(outputW,outputH)),finalW=Math.round(outputW*outputScale);
      $('[data-adjust-size]').textContent=`${finalW} × ${Math.round(outputH*finalW/outputW)} px`;
      box.setAttribute('aria-label',`Crop: ${Math.round(c.width*100)}% wide, ${Math.round(c.height*100)}% high. Arrow keys move the crop.`);
      $('[data-adjust-apply]').disabled=busy||!validAngle();
    }
    function angleChanged() {
      if (!validAngle()) { status('Enter a number from −180° to 180°. Your input is kept.');capture();$('[data-adjust-apply]').disabled=true;return; }
      recipe.rotation=Number($('#adjust-degrees').value);
      $('#adjust-angle').value=recipe.rotation;
      const f=model.frame(image?.naturalWidth||photo.width,image?.naturalHeight||photo.height,recipe.rotation);
      if (Number($('#adjust-ratio').value)) recipe.crop=model.presetCrop(f.width,f.height,Number($('#adjust-ratio').value));
      status('');capture();draw();
    }
    async function open() {
      if (busy) return;
      const c=getContext();photo=c.photo;journeyId=c.journey.id;
      if (!photo) return;
      const previous=c.state.photos[photo.id]?.imageEdit;
      recipe={rotation:previous?.rotation||0,crop:{...(previous?.crop||model.fullCrop())}};
      $('#adjust-degrees').value=previous?.rotationInput??recipe.rotation;
      $('#adjust-angle').value=recipe.rotation;$('#adjust-ratio').value='0';
      loaded=false;stage.hidden=true;dialog.querySelector('fieldset').disabled=true;$('[data-adjust-apply]').disabled=true;
      status('Loading photo…');dialog.showModal();
      const ticket=++version;
      image=new Image();
      image.onload=()=>{if(ticket!==version)return;loaded=true;stage.hidden=false;dialog.querySelector('fieldset').disabled=false;status(validAngle()?'Drag the crop or its corners.':'Enter a number from −180° to 180°.');draw();};
      image.onerror=()=>{if(ticket===version){dialog.querySelector('fieldset').disabled=false;status('Photo unavailable locally. Your edits are kept. Restore its private photo assets and reopen Crop & rotate.');}};
      // The editor and encoding endpoint select the same unedited source.
      image.src=`/api/photo-adjustments/source?journeyId=${encodeURIComponent(journeyId)}&photoId=${encodeURIComponent(photo.id)}`;
    }
    $('#adjust-degrees').addEventListener('input',angleChanged);
    $('#adjust-angle').addEventListener('input',()=>{$('#adjust-degrees').value=$('#adjust-angle').value;angleChanged();});
    dialog.querySelectorAll('[data-turn]').forEach(button=>button.addEventListener('click',()=>{
      $('#adjust-degrees').value=round(model.normalizeRotation(recipe.rotation+Number(button.dataset.turn)));angleChanged();
    }));
    $('#adjust-ratio').addEventListener('change',()=>{
      if (!loaded) return;
      const f=model.frame(image.naturalWidth,image.naturalHeight,recipe.rotation);
      recipe.crop=model.presetCrop(f.width,f.height,Number($('#adjust-ratio').value));capture();draw();
    });
    $('[data-adjust-reset]').addEventListener('click',()=>{
      $('#adjust-degrees').value='0';$('#adjust-ratio').value='0';recipe.crop=model.fullCrop();angleChanged();
    });
    $('[data-adjust-original]').addEventListener('click',()=>{
      setEdit(photo.id,null);dialog.close();refresh();
    });
    $('[data-adjust-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    dialog.addEventListener('close',()=>{version++;document.querySelector('#photo-adjust-open').focus();});
    box.addEventListener('pointerdown',event=>{
      if (busy||event.button!==0) return;
      event.preventDefault();box.focus();
      drag={x:event.clientX,y:event.clientY,crop:{...recipe.crop},handle:event.target.dataset.handle,rect:stage.getBoundingClientRect()};
      box.setPointerCapture(event.pointerId);
    });
    box.addEventListener('pointermove',event=>{
      if (!drag) return;
      const dx=(event.clientX-drag.x)/drag.rect.width,dy=(event.clientY-drag.y)/drag.rect.height,c=drag.crop;
      let next;
      if (!drag.handle) next={...c,x:clamp(c.x+dx,0,1-c.width),y:clamp(c.y+dy,0,1-c.height)};
      else {
        const west=drag.handle.includes('w'),north=drag.handle.includes('n');
        const anchorX=west?c.x+c.width:c.x,anchorY=north?c.y+c.height:c.y;
        let width=clamp(c.width+(west?-dx:dx),.03,west?anchorX:1-anchorX);
        let height=clamp(c.height+(north?-dy:dy),.03,north?anchorY:1-anchorY);
        const ratio=Number($('#adjust-ratio').value);
        if (ratio) {
          const f=model.frame(image.naturalWidth,image.naturalHeight,recipe.rotation),r=ratio/(f.width/f.height);
          width=Math.min(width,height*r);height=width/r;
        }
        next={x:west?anchorX-width:anchorX,y:north?anchorY-height:anchorY,width,height};
      }
      recipe.crop=Object.fromEntries(Object.entries(next).map(([k,v])=>[k,round(v)]));
      recipe.crop.width=Math.min(recipe.crop.width,1-recipe.crop.x);recipe.crop.height=Math.min(recipe.crop.height,1-recipe.crop.y);
      capture();draw();
    });
    const endDrag=()=>{drag=null;};
    box.addEventListener('pointerup',endDrag);box.addEventListener('pointercancel',endDrag);box.addEventListener('lostpointercapture',endDrag);
    box.addEventListener('keydown',event=>{
      const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if (!directions[event.key]||busy) return;
      event.preventDefault();const [dx,dy]=directions[event.key],step=event.shiftKey ? .1 : .01,c=recipe.crop;
      recipe.crop={...c,x:Math.min(round(clamp(c.x+dx*step,0,1-c.width)),1-c.width),y:Math.min(round(clamp(c.y+dy*step,0,1-c.height)),1-c.height)};capture();draw();
    });
    dialog.querySelectorAll('[data-crop-field]').forEach(field=>field.addEventListener('input',()=>{
      const key=field.dataset.cropField,n=Number(field.value)/100;
      if (!field.value.trim()||!Number.isFinite(n)) return;
      $('#adjust-ratio').value='0';const c=recipe.crop;
      if (key==='x'||key==='y') c[key]=clamp(n,0,1-c[key==='x'?'width':'height']);
      else c[key]=clamp(n,.03,1-c[key==='width'?'x':'y']);
      capture();draw();
    }));
    $('[data-adjust-apply]').addEventListener('click',async()=>{
      if (busy||!loaded||!validAngle()) return;
      if (!recipe.rotation && JSON.stringify(recipe.crop)===JSON.stringify(model.fullCrop())) {
        setEdit(photo.id,null);dialog.close();refresh();return;
      }
      busy=true;dialog.querySelector('fieldset').disabled=true;
      $('[data-adjust-close]').disabled=true;$('[data-adjust-apply]').disabled=true;
      status('Preparing your crop…');
      const id=photo.id,before=structuredClone(getContext().state.photos[id]?.imageEdit);
      try {
        const response=await fetch('/api/photo-adjustments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({journeyId,photoId:id,recipe})});
        const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Could not prepare the crop.');
        if (JSON.stringify(getContext().state.photos[id]?.imageEdit)!==JSON.stringify(before)) throw new Error('Newer crop changes were kept. Apply them again.');
        const publishedAssets=before?.assets?.assetStatus==='published'?before.assets:before?.publishedAssets;
        setEdit(id,{...result.imageEdit,...(publishedAssets?{publishedAssets}:{})});
        dialog.close();refresh();
      } catch(error) {status(`${error.message} Your crop is kept; try again.`);}
      finally {busy=false;dialog.querySelector('fieldset').disabled=false;$('[data-adjust-close]').disabled=false;draw();}
    });
    document.querySelector('#photo-adjust-open').addEventListener('click',open);
    return {open};
  }
  root.JOURNEY_ATLAS_PHOTO_ADJUSTMENTS_UI={create};
})(window);
