// Restore the committed scientific snapshot without contacting JPL.
import {cp,mkdir} from 'node:fs/promises';
for(const name of ['data','textures']){
 await mkdir('public/'+name,{recursive:true});
 await cp('../../docs/solar-system/'+name,'public/'+name,{recursive:true});
}
console.log('Restored the published asset snapshot to public/.');
