/** Shared installer for the live headed-mode cursor HUD. */
function hudEnsureSource(): string {
  return [
    'var hud=document.querySelector("[data-ba-hud]");',
    'if(!hud){',
    'hud=document.createElement("div");',
    'hud.setAttribute("data-ba-hud","");',
    'hud.innerHTML=\'<i data-ba-hud-el="cursor" class="ba-hud-cursor"></i><i data-ba-hud-el="ripple" class="ba-hud-ripple"></i><i data-ba-hud-el="swipe" class="ba-hud-swipe"></i><i data-ba-hud-el="type" class="ba-hud-type"></i><b data-ba-hud-el="key" class="ba-hud-key"></b>\';',
    'var s=document.createElement("style");',
    's.textContent="[data-ba-hud]{position:fixed;inset:0;pointer-events:none;z-index:2147483647}[data-ba-hud] i,[data-ba-hud] b{position:absolute;display:block;left:0;top:0}',
    '.ba-hud-cursor{width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px #5b9dff,0 4px 14px rgba(0,0,0,.35);transition:transform .22s ease}',
    '.ba-hud-ripple{width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:2px solid #5b9dff;opacity:0}',
    '.ba-hud-ripple.ba-hud-ripple-on{animation:baHudRipple .45s ease-out}',
    '.ba-hud-swipe{width:10px;height:64px;margin:-32px 0 0 -5px;border-radius:8px;background:linear-gradient(#5b9dff,transparent);opacity:0}',
    '.ba-hud-swipe.ba-hud-swipe-on{animation:baHudSwipe .4s ease-out}',
    '.ba-hud-type{width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;border:2px solid #f5c16c;opacity:0}',
    '.ba-hud-type.ba-hud-type-on{animation:baHudRipple .4s ease-out}',
    '.ba-hud-key{min-width:28px;padding:3px 8px;margin:-14px 0 0 14px;border-radius:6px;background:#111827;color:#e8eefc;font:12px/1.2 sans-serif;opacity:0}',
    '.ba-hud-key.ba-hud-key-on{animation:baHudKey .5s ease-out}',
    '@keyframes baHudRipple{from{transform:scale(.4);opacity:.95}to{transform:scale(6);opacity:0}}',
    '@keyframes baHudSwipe{from{transform:translateY(-24px) scaleY(.4);opacity:.9}to{transform:translateY(36px) scaleY(1.2);opacity:0}}',
    '@keyframes baHudKey{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-10px)}}";',
    'hud.appendChild(s);',
    'document.documentElement.appendChild(hud);',
    '}',
    'var cursor=hud.querySelector(".ba-hud-cursor");',
    'var ripple=hud.querySelector(".ba-hud-ripple");',
    'var swipe=hud.querySelector(".ba-hud-swipe");',
    'var typeRing=hud.querySelector(".ba-hud-type");',
    'var keyChip=hud.querySelector(".ba-hud-key");',
    'function place(el,x,y){if(el)el.style.transform="translate("+x+"px,"+y+"px)";}',
    'function bang(el,cls){if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}',
  ].join('')
}

function elementCenterPrelude(): string {
  return (
    hudEnsureSource() +
    'var box=this.getBoundingClientRect();var x=box.left+box.width/2;var y=box.top+box.height/2;place(cursor,x,y);'
  )
}

/** CDP function() body: move the cursor and click with a ripple. */
export function clickHudDeclaration(): string {
  return (
    'function(){' +
    elementCenterPrelude() +
    'place(ripple,x,y);bang(ripple,"ba-hud-ripple-on");this.click();}'
  )
}

/** CDP function() body: move the cursor, pulse, and focus. No fill. */
export function typeHudFocusDeclaration(): string {
  return (
    'function(){' +
    elementCenterPrelude() +
    'place(typeRing,x,y);bang(typeRing,"ba-hud-type-on");this.focus();}'
  )
}

/** CDP function() body: append one character like a keystroke. */
export function typeHudCharDeclaration(character: string): string {
  const encoded = JSON.stringify(character)
  return (
    'function(){' +
    'var proto=this instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;' +
    'var desc=Object.getOwnPropertyDescriptor(proto,"value");' +
    'var next=(this.value||"")+ ' +
    encoded +
    ';' +
    'if(desc&&desc.set){desc.set.call(this,next);}else{this.value=next;}' +
    'this.dispatchEvent(new InputEvent("input",{bubbles:true,data:' +
    encoded +
    ',inputType:"insertText"}));}'
  )
}

/** CDP function() body: fire change after the last character. */
export function typeHudCommitDeclaration(): string {
  return 'function(){this.dispatchEvent(new Event("change",{bubbles:true}));}'
}

/** CDP function() body: move the cursor and hover. */
export function hoverHudDeclaration(): string {
  return (
    'function(){' +
    elementCenterPrelude() +
    'this.dispatchEvent(new MouseEvent("mouseover",{bubbles:true}));}'
  )
}

/** CDP function() body: swipe indicator then scrollBy. */
export function scrollHudDeclaration(dx: number, dy: number): string {
  return (
    'function(){' +
    hudEnsureSource() +
    'var box=this.getBoundingClientRect();var x=box.left+box.width/2;var y=box.top+box.height/2;' +
    'place(cursor,x,y);place(swipe,x,y);bang(swipe,"ba-hud-swipe-on");this.scrollBy(' +
    dx +
    ', ' +
    dy +
    ');}'
  )
}

/** Page script: pick an option by value or visible label, then fire change. */
export function selectOptionSource(value: string): string {
  return (
    'var want=' +
    JSON.stringify(value) +
    ';' +
    'var opts=this.options;var pick=-1;var best=0;' +
    'if(opts){for(var i=0;i<opts.length;i++){' +
    'var opt=opts[i];var label=(opt.text||opt.label||"").replace(/^\\s+|\\s+$/g,"");' +
    'var score=0;if(opt.value===want){score=3;}else if(label===want){score=2;}' +
    'else if(want!==""&&label.indexOf(want)>=0){score=1;}' +
    'if(score>best){best=score;pick=i;if(score===3){break;}}}' +
    'if(pick>=0){this.selectedIndex=pick;}else{this.value=want;}}' +
    'else{this.value=want;}' +
    'this.dispatchEvent(new Event("input",{bubbles:true}));' +
    'this.dispatchEvent(new Event("change",{bubbles:true}));' +
    'if(typeof angular!=="undefined"&&angular.element){' +
    'var ng=angular.element(this);if(ng.triggerHandler){ng.triggerHandler("change");}}'
  )
}

/** CDP function() body: ring the control and select a value. */
export function selectHudDeclaration(value: string): string {
  return (
    'function(){' +
    elementCenterPrelude() +
    'place(typeRing,x,y);bang(typeRing,"ba-hud-type-on");' +
    selectOptionSource(value) +
    '}'
  )
}

/** Page evaluate script for a key press HUD. Page keys also swipe. */
export function pressHudEvaluate(key: string): string {
  const encoded = JSON.stringify(key)
  const pageKey = key === 'PageDown' || key === 'PageUp' || key === 'Space'
  const swipe = pageKey
    ? 'place(swipe,innerWidth/2,innerHeight/2);bang(swipe,"ba-hud-swipe-on");'
    : ''
  return (
    '(function(){' +
    hudEnsureSource() +
    'var x=innerWidth/2;var y=innerHeight/2;place(cursor,x,y);' +
    swipe +
    'if(keyChip){keyChip.textContent=' +
    encoded +
    ';place(keyChip,x,y);bang(keyChip,"ba-hud-key-on");}' +
    '})()'
  )
}
