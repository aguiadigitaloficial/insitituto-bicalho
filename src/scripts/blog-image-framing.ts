import type {Asset,Snapshot} from '../lib/blog/model';
import {FRAME_RATIOS,defaultFrame,resolveFrame,frameGeometry,frameStyle,type Frame,type FrameContext} from '../lib/blog/framing';

const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const contexts:FrameContext[]=['article','listing','compact'];
const labels:Record<FrameContext,string>={article:'Capa do artigo',listing:'Listagens e destaques',compact:'Chamadas compactas'};
const recommendations:Record<FrameContext,{width:number;height:number;ratio:string}>={article:{width:1600,height:1200,ratio:'4:3'},listing:{width:1800,height:1200,ratio:'3:2'},compact:{width:1200,height:1200,ratio:'1:1'}};
const assetFor=(snapshot:Snapshot,assets:Asset[],context:FrameContext)=>assets.find(asset=>asset.id===(context==='article'?snapshot.coverId:snapshot.thumbnailId||snapshot.coverId));
const privatePreview=(asset:Asset)=>`/api/blog/media-file/?id=${encodeURIComponent(asset.id)}&width=1200`;
const limit=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const frameFor=(snapshot:Snapshot,context:FrameContext)=>resolveFrame(snapshot.imageFraming?.[context]);

/** These previews use the same geometry as the public article, without rewriting the source image. */
export function imageFramingPreviews(snapshot:Snapshot,assets:Asset[],selection:FrameContext[]):string{
 return `<div class="image-framing-previews">${selection.map(context=>{
  const asset=assetFor(snapshot,assets,context);
  if(!asset)return `<div class="image-framing-empty"><strong>${labels[context]}</strong><p>Selecione ${context==='article'?'uma capa':'uma miniatura ou capa'} para visualizar e ajustar o enquadramento.</p></div>`;
  const frame=frameFor(snapshot,context),recommended=recommendations[context];
  return `<figure class="image-framing-preview" data-frame-preview="${context}"><div class="image-framing-viewport" style="aspect-ratio:${FRAME_RATIOS[context]}"><img src="${privatePreview(asset)}" alt="${escapeHtml(asset.alt)}" style="${frameStyle(asset.width,asset.height,context,frame)}" draggable="false"></div><figcaption><strong>${labels[context]}</strong><span>${context!=='article'&&!snapshot.thumbnailId?'Usa a imagem de capa · ':''}${asset.width} × ${asset.height} px · ${recommended.ratio}</span></figcaption><button type="button" data-adjust-frame="${context}">Ajustar enquadramento<span class="framing-sr-only">: ${labels[context]}</span></button></figure>`;
 }).join('')}</div>`;
}

type FramingOptions={
 dialog:HTMLDialogElement;
 body:HTMLElement;
 snapshot:Snapshot;
 assets:Asset[];
 initialContext:FrameContext;
 onApply:(frames:NonNullable<Snapshot['imageFraming']>)=>void;
};

/** Dialog state is isolated: closing, Escape or Cancel never changes the editable article. */
export function openImageFraming({dialog,body,snapshot,assets,initialContext,onApply}:FramingOptions):void{
 const available=contexts.filter(context=>assetFor(snapshot,assets,context));
 if(!available.length)return;
 let active=available.includes(initialContext)?initialContext:available[0];
 const pending:NonNullable<Snapshot['imageFraming']>=structuredClone(snapshot.imageFraming||{});
 const abort=new AbortController();
 const {signal}=abort;
 const previousLabel=dialog.getAttribute('aria-label');
 const previousLabelledby=dialog.getAttribute('aria-labelledby');
 let dragging:{id:number;clientX:number;clientY:number;x:number;y:number;overflowX:number;overflowY:number}|undefined;
 let imageRequest=0;
 let applied=false;

 body.innerHTML=`<div class="framing-editor"><h2 id="framing-dialog-title">Ajustar enquadramento</h2><p class="admin-help">Cada formato tem um ajuste independente. A fotografia original será preservada.</p><div class="framing-tabs" role="tablist" aria-label="Formato da imagem">${contexts.map(context=>`<button type="button" role="tab" id="frame-tab-${context}" aria-controls="framing-panel" data-frame-context="${context}" ${!available.includes(context)?'disabled':''}>${labels[context]}</button>`).join('')}</div><section id="framing-panel" class="framing-panel" role="tabpanel"><div class="framing-preview-column"><div class="framing-stage image-framing-viewport" data-frame-stage role="img" aria-label="Prévia do enquadramento" aria-describedby="framing-instructions"><img data-frame-image alt="" draggable="false"></div><p id="framing-instructions" class="admin-help">Arraste a fotografia para reposicionar. Você também pode usar os controles de posição com as setas do teclado.</p><p class="framing-image-status" data-frame-image-status role="status"></p></div><div class="framing-controls"><p class="framing-dimensions" data-frame-dimensions></p><p class="framing-warning" data-frame-warning></p><label>Exibição<select data-frame-mode><option value="cover">Preencher moldura</option><option value="contain">Mostrar imagem inteira</option></select></label><label>Ampliação <output data-frame-value="zoom"></output><input type="range" data-frame-control="zoom" min="100" max="300" step="1" aria-label="Ampliação da imagem"></label><label>Posição horizontal <output data-frame-value="x"></output><input type="range" data-frame-control="x" min="0" max="100" step="1" aria-label="Posição horizontal"></label><label>Posição vertical <output data-frame-value="y"></output><input type="range" data-frame-control="y" min="0" max="100" step="1" aria-label="Posição vertical"></label><p class="admin-help" data-frame-mode-help></p><button type="button" data-frame-reset>Restaurar enquadramento</button></div></section><div class="framing-actions"><button type="button" data-frame-cancel>Cancelar</button><button type="button" class="primary" data-frame-apply>Aplicar enquadramento</button></div></div>`;
 const stage=body.querySelector<HTMLElement>('[data-frame-stage]')!;
 const image=body.querySelector<HTMLImageElement>('[data-frame-image]')!;
 const mode=body.querySelector<HTMLSelectElement>('[data-frame-mode]')!;
 const tabs=[...body.querySelectorAll<HTMLButtonElement>('[data-frame-context]')];
 const controls={zoom:body.querySelector<HTMLInputElement>('[data-frame-control="zoom"]')!,x:body.querySelector<HTMLInputElement>('[data-frame-control="x"]')!,y:body.querySelector<HTMLInputElement>('[data-frame-control="y"]')!};
 const imageStatus=body.querySelector<HTMLElement>('[data-frame-image-status]')!;

 function finishDrag(){
  if(dragging&&stage.hasPointerCapture(dragging.id))stage.releasePointerCapture(dragging.id);
  dragging=undefined;stage.classList.remove('is-dragging');
 }
 function cleanup(){
  finishDrag();abort.abort();dialog.classList.remove('image-framing-dialog');
  if(previousLabel===null)dialog.removeAttribute('aria-label');else dialog.setAttribute('aria-label',previousLabel);
  if(previousLabelledby===null)dialog.removeAttribute('aria-labelledby');else dialog.setAttribute('aria-labelledby',previousLabelledby);
  image.onload=null;image.onerror=null;
  // Applying refreshes the preview buttons. Restore focus to the replacement, not its removed predecessor.
  if(applied)document.querySelector<HTMLButtonElement>(`[data-adjust-frame="${initialContext}"]`)?.focus({preventScroll:true});
 }
 function render(loadImage=false){
  const asset=assetFor(snapshot,assets,active)!;
  const frame=resolveFrame(pending[active]);
  const recommended=recommendations[active];
  const whole=frame.mode==='contain';
  stage.style.aspectRatio=String(FRAME_RATIOS[active]);
  stage.dataset.frameMode=frame.mode;
  stage.setAttribute('aria-label',`${labels[active]}: ${whole?'imagem inteira':'enquadramento ajustável'}`);
  image.style.cssText=frameStyle(asset.width,asset.height,active,frame);
  mode.value=frame.mode;
  controls.zoom.value=String(Math.round(frame.zoom*100));controls.x.value=String(Math.round(frame.x));controls.y.value=String(Math.round(frame.y));
  for(const key of ['zoom','x','y']as const){controls[key].disabled=whole;body.querySelector<HTMLOutputElement>(`[data-frame-value="${key}"]`)!.value=`${Math.round(key==='zoom'?frame.zoom*100:frame[key])}%`;}
  body.querySelector<HTMLElement>('[data-frame-mode-help]')!.textContent=whole?'A fotografia inteira fica centralizada. Ampliação e posição estão desativadas neste modo.':'O recorte respeita as bordas da imagem, sem deixar espaços vazios.';
  body.querySelector<HTMLElement>('[data-frame-dimensions]')!.textContent=`Imagem: ${asset.width} × ${asset.height} px. Recomendado para ${labels[active].toLowerCase()}: ${recommended.width} × ${recommended.height} px (${recommended.ratio}).`;
  const warning=body.querySelector<HTMLElement>('[data-frame-warning]')!;
  const geometry=frameGeometry(asset.width,asset.height,active,frame);
  const requiredWidth=recommended.width*geometry.width/100,requiredHeight=recommended.height*geometry.height/100;
  const lowResolution=asset.width+1<requiredWidth||asset.height+1<requiredHeight;
  warning.hidden=!lowResolution;
  warning.textContent=lowResolution?'Esta imagem tem resolução abaixo da recomendada para este enquadramento. Mais ampliação pode reduzir a nitidez. Você pode continuar com o arquivo atual.':'';
  tabs.forEach(tab=>{const selected=tab.dataset.frameContext===active;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  body.querySelector('#framing-panel')!.setAttribute('aria-labelledby',`frame-tab-${active}`);
  if(loadImage){
   const request=++imageRequest;
   imageStatus.textContent='Carregando a prévia da imagem…';
   image.onload=()=>{if(!signal.aborted&&request===imageRequest)imageStatus.textContent='';};
   image.onerror=()=>{if(!signal.aborted&&request===imageRequest)imageStatus.textContent='Não foi possível carregar a prévia. Feche e abra o ajuste para tentar novamente.';};
   image.src=privatePreview(asset);
  }
 }
 function update(values:Partial<Frame>){pending[active]={...resolveFrame(pending[active]),...values};render();}
 tabs.forEach(tab=>{
  tab.addEventListener('click',()=>{finishDrag();active=tab.dataset.frameContext as FrameContext;render(true);},{signal});
  tab.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();const enabled=tabs.filter(button=>!button.disabled),index=enabled.indexOf(tab);
   const next=event.key==='Home'?0:event.key==='End'?enabled.length-1:(index+(event.key==='ArrowRight'?1:-1)+enabled.length)%enabled.length;
   enabled[next].click();enabled[next].focus();
  },{signal});
 });
 mode.addEventListener('change',()=>{finishDrag();update(mode.value==='contain'?{mode:'contain',x:50,y:50,zoom:1}:{mode:'cover'});},{signal});
 for(const key of ['zoom','x','y']as const)controls[key].addEventListener('input',()=>{const value=Number(controls[key].value);update({[key]:key==='zoom'?limit(value/100,1,3):limit(value,0,100)});},{signal});
 stage.addEventListener('pointerdown',event=>{
  const frame=resolveFrame(pending[active]);if(frame.mode!=='cover'||(event.pointerType==='mouse'&&event.button!==0)||!event.isPrimary)return;
  const asset=assetFor(snapshot,assets,active)!,bounds=stage.getBoundingClientRect(),geometry=frameGeometry(asset.width,asset.height,active,frame);
  dragging={id:event.pointerId,clientX:event.clientX,clientY:event.clientY,x:frame.x,y:frame.y,overflowX:bounds.width*Math.max(0,geometry.width/100-1),overflowY:bounds.height*Math.max(0,geometry.height/100-1)};
  stage.setPointerCapture(event.pointerId);stage.classList.add('is-dragging');event.preventDefault();
 },{signal});
 stage.addEventListener('pointermove',event=>{
  if(!dragging||event.pointerId!==dragging.id)return;
  update({x:dragging.overflowX>.01?limit(dragging.x-(event.clientX-dragging.clientX)/dragging.overflowX*100,0,100):50,y:dragging.overflowY>.01?limit(dragging.y-(event.clientY-dragging.clientY)/dragging.overflowY*100,0,100):50});event.preventDefault();
 },{signal});
 stage.addEventListener('pointerup',finishDrag,{signal});stage.addEventListener('pointercancel',finishDrag,{signal});stage.addEventListener('lostpointercapture',()=>{dragging=undefined;stage.classList.remove('is-dragging');},{signal});
 body.querySelector('[data-frame-reset]')!.addEventListener('click',()=>{finishDrag();pending[active]=defaultFrame();render();},{signal});
 body.querySelector('[data-frame-cancel]')!.addEventListener('click',()=>dialog.close(),{signal});
 body.querySelector('[data-frame-apply]')!.addEventListener('click',()=>{if(applied)return;applied=true;finishDrag();onApply(structuredClone(pending));dialog.close();},{signal});
 dialog.addEventListener('cancel',finishDrag,{signal});
 dialog.addEventListener('close',cleanup,{once:true,signal});
 dialog.classList.add('image-framing-dialog');dialog.removeAttribute('aria-label');dialog.setAttribute('aria-labelledby','framing-dialog-title');
 render(true);dialog.showModal();tabs.find(tab=>tab.dataset.frameContext===active)?.focus();
}
