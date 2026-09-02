/* IL CASO VERO: la tela e' esattamente il rettangolo dello sticker.
   Il quadrato la riempie tutta — gli unici pixel trasparenti sono i quattro
   angoli arrotondati. E' la geometria che il motore incontra davvero. */
require('./shimlib.js');
const {resinDome,S}=global.__D;
const N=600, ppm=16, rc=70;
const cv=new global.__Canvas(); cv.width=N; cv.height=N;
const d=cv.getContext('2d').d;
let fuori=0;
for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const dx=Math.max(rc-x,0)+Math.max(x-(N-1-rc),0);
  const dy=Math.max(rc-y,0)+Math.max(y-(N-1-rc),0);
  const q=(y*N+x)*4;
  if(Math.hypot(dx,dy)<=rc){d[q]=196;d[q+1]=26;d[q+2]=92;d[q+3]=255;} else fuori++;
}
console.log('pixel trasparenti: %d su %d (%s%%) — solo i quattro angoli',
  fuori,N*N,(100*fuori/(N*N)).toFixed(2));
S.prod='resin';
require('fs').writeFileSync(__dirname+'/pieno.raw',
  Buffer.from(resinDome(cv,ppm).getContext('2d').d));
console.log('scritto pieno.raw  ('+N+'x'+N+' RGBA)');
