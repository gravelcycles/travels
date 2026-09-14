(function (root) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function highlight(before, after) {
    if (!before) return ['',`<ins>${escape(after)}</ins>`];
    if (!after) return [`<del>${escape(before)}</del>`,''];
    if (before.length+after.length>50000) return [escape(before),escape(after)];
    const a=before.match(/\s+|[^\s]+/g) || [],b=after.match(/\s+|[^\s]+/g) || [];
    // Bound the word comparison for long stories; retain full text in either case.
    if (a.length*b.length>250000) return [escape(before),escape(after)];
    const rows=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
    for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)rows[i][j]=a[i]===b[j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1]);
    let left='',right='',i=0,j=0;
    while(i<a.length || j<b.length){
      if(i<a.length && j<b.length && a[i]===b[j]){left+=escape(a[i++]);right+=escape(b[j++]);}
      else if(i<a.length && (j===b.length || rows[i+1][j]>=rows[i][j+1]))left+=`<del>${escape(a[i++])}</del>`;
      else right+=`<ins>${escape(b[j++])}</ins>`;
    }
    return [left,right];
  }
  function value(display, marked) {
    const text=display.empty?`<em>${escape(display.text)}</em>`:(marked ?? escape(display.text));
    return `<div class="draft-value">${text}</div>${display.details?`<details class="draft-value-details"><summary>Show full details</summary><pre>${escape(display.details)}</pre></details>`:''}`;
  }
  function render(changes, photoUrl = url=>url) {
    const groups=new Map();
    for(const change of changes){
      if(!groups.has(change.groupId))groups.set(change.groupId,{...change,changes:[]});
      groups.get(change.groupId).changes.push(change);
    }
    const counts=new Map();
    for(const group of groups.values())counts.set(group.kind,(counts.get(group.kind)||0)+1);
    const nouns={Day:['day','days'],Photo:['photo','photos'],Route:['route','routes'],Trip:['trip','trips'],Place:['place','places'],'Replay chapter':['Replay chapter','Replay chapters'],Traveler:['traveler','travelers'],'Travel group':['travel group','travel groups'],Video:['video','videos']};
    const summary=changes.length?`${changes.length} ${changes.length===1?'change':'changes'} in ${[...counts].map(([kind,n])=>`${n} ${(nouns[kind]||['item','items'])[n===1?0:1]}`).join(', ')}.`:'Your draft matches the saved files.';
    let journey='';
    const html=[...groups.values()].sort((a,b)=>a.journey.localeCompare(b.journey)).map(group=>{
      const heading=group.journey!==journey?`<h3 class="draft-journey">${escape(group.journey)}</h3>`:'';journey=group.journey;
      const thumbnail=photoUrl(group.thumbnail);
      // Only render ordinary image URLs; never place arbitrary schemes in markup.
      const image=thumbnail && /^(?:\/(?!\/)|\.\/|https?:\/\/)/.test(thumbnail)?`<img src="${escape(thumbnail)}" alt="" loading="lazy">`:'';
      return `${heading}<section class="draft-change-group"><header>${image}<div><span class="draft-kind">${escape(group.kind)}</span><h4>${escape(group.subject)}</h4>${group.context?`<p>${escape(group.context)}</p>`:''}</div><span class="draft-change-count">${group.changes.length} ${group.changes.length===1?'change':'changes'}</span></header>${group.changes.map(change=>{
        const marked=change.textDiff?highlight(change.before,change.after):[];
        return `<section class="draft-change"><h5>${escape(change.field)}</h5><div class="draft-change-values"><div><strong>Saved</strong>${value(change.displayBefore,marked[0])}</div><div><strong>Your changes</strong>${value(change.displayAfter,marked[1])}</div></div></section>`;
      }).join('')}</section>`;
    }).join('');
    return {summary,html};
  }
  root.JOURNEY_ATLAS_DRAFT_REVIEW={render,highlight};
})(globalThis);
