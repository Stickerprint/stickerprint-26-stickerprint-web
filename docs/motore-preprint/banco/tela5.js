/* I quattro bianchi con la stessa geometria dei mockup di riferimento. */
require('./shimlib.js');
const {resinDome,S}=global.__D;
document.getElementById('shp').value='square';
function rendi(W,H,tipo,nome){
  const cv=new global.__Canvas(); cv.width=W; cv.height=H;
  const d=cv.getContext('2d').d, rc=Math.min(W,H)*0.13;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    let dentro;
    if(tipo==='ell'){const a=W/2,b=H/2;dentro=((x-a)/a)**2+((y-b)/b)**2<=1;}
    else{const dx=Math.max(rc-x,0)+Math.max(x-(W-1-rc),0),
               dy=Math.max(rc-y,0)+Math.max(y-(H-1-rc),0);
         dentro=Math.hypot(dx,dy)<=rc;}
    if(dentro){const q=(y*W+x)*4;d[q]=250;d[q+1]=250;d[q+2]=251;d[q+3]=255;}
  }
  S.prod='resin';
  require('fs').writeFileSync(__dirname+'/'+nome+'.raw',
    Buffer.from(resinDome(cv,16).getContext('2d').d));
  console.log('  '+nome+'.raw  '+W+'x'+H);
}
rendi(560,560,'rr','w_quadrato'); rendi(760,470,'rr','w_rettangolo');
rendi(760,470,'ell','w_ovale');   rendi(560,560,'ell','w_tondo');
