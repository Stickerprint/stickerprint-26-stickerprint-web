/* Tela minima ma VERA: getImageData/putImageData restituiscono pixel reali,
   cosi' le funzioni del motore lavorano davvero invece di girare a vuoto. */
global.__MUTO=true;
class Ctx{
  constructor(cv){this.cv=cv;this.d=new Uint8ClampedArray(cv.width*cv.height*4);}
  getImageData(x,y,w,h){return {width:w,height:h,data:this.d};}
  putImageData(id){this.d=id.data;}
  createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};}
  drawImage(){} clearRect(){} fillRect(){} save(){} restore(){} setTransform(){}
  createLinearGradient(){return{addColorStop(){}};} fill(){} stroke(){} clip(){} beginPath(){}
}
class Canvas{
  constructor(){this.width=1;this.height=1;this._c=null;}
  getContext(){if(!this._c)this._c=new Ctx(this);return this._c;}
  toDataURL(){return 'data:,';}
}
const cache={};
const mk=id=>({id,dataset:{},style:{},
  classList:{add(){},remove(){},toggle(){},contains:()=>false},
  children:[],value:'',textContent:'',innerHTML:'',checked:false,
  clientWidth:800,clientHeight:600,
  appendChild(c){return c},addEventListener(){},querySelector:()=>mk('q'),
  querySelectorAll:()=>[],getContext:()=>({}),toDataURL:()=>'data:,',
  getBoundingClientRect:()=>({width:800,height:600}),closest:()=>mk('l'),
  focus(){},click(){},remove(){},setAttribute(){},getAttribute:()=>null,
  removeAttribute(){},hasAttribute:()=>false,
  get firstChild(){return this._f||(this._f=mk('b'))},width:1,height:1});
const IDS=new Set(require('./ids.json'));
global.document={
  getElementById:id=>IDS.has(id)?(cache[id]||(cache[id]=mk(id))):null,
  createElement:t=>t==='canvas'?new Canvas():mk(t),
  querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},dispatchEvent(){},
  body:mk('body'),documentElement:mk('h'),head:mk('h'),createElementNS:()=>mk('svg')};
global.window=global; global.location={search:''}; global.navigator={userAgent:'x'};
global.requestAnimationFrame=()=>0; global.addEventListener=()=>{};
global.CustomEvent=class{constructor(a,b){Object.assign(this,b)}};
global.Path2D=class{}; global.Image=class{}; global.URL={createObjectURL:()=>''};
global.localStorage={getItem:()=>null,setItem(){}}; global.matchMedia=()=>({matches:false});
global.indexedDB={open:()=>({})}; global.OffscreenCanvas=Canvas;
global.devicePixelRatio=1; global.innerWidth=1400; global.innerHeight=900;
global.setTimeout=f=>0; global.scrollTo=()=>{};
global.__Canvas=Canvas;
require('./motore.js');
