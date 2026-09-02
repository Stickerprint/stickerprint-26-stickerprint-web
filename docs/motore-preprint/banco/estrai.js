/* Estrae il JavaScript da preprint.html e lo prepara per il banco:
   zittisce le funzioni che disegnano nell'interfaccia (non c'e' un browser)
   e apre un varco su quelle che servono ai test. */
const fs=require('fs'), path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','preprint.html'),'utf8');
let js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
for(const f of ['paintAlts','paintPalette','paintSwatch','bgFixBar','drawMaskView',
                'renumberSteps','uSummary','computeLayout','buildArtCanvas','draw','fitPreview'])
  js=js.replace('function '+f+'(', 'function '+f+'(){if(global.__MUTO)return;}\nfunction __'+f+'(');
js+="\nglobal.__D={resinDome,S,RES,autoSegment,computeMask,buildPalette,hexOf};\n";
fs.writeFileSync(path.join(__dirname,'motore.js'),js);
const ids=[...new Set([...html.matchAll(/id="([A-Za-z0-9_]+)"/g)].map(m=>m[1]))].sort();
fs.writeFileSync(path.join(__dirname,'ids.json'),JSON.stringify(ids));
console.log('motore estratto:', (js.length/1024|0)+' kB ·', ids.length, 'id');
