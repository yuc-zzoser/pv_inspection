'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb');
const {webcrypto}=require('node:crypto');
const {TextEncoder,TextDecoder}=require('node:util');
function load(file){
 const context={indexedDB,IDBKeyRange,crypto:webcrypto,Blob,TextEncoder,TextDecoder,Uint8Array,DataView,Promise,Map,Set,Error,TypeError,console};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 return context;
}
test('separate records and binary Blob evidence survive database reopening',async()=>{
 const ctx=load('src/storage-v06.js'),s=ctx.PVStorageV06;
 const plant={id:'test-plant-1',name:'Plant',meta:{created:'2026-11-04',modified:'2026-11-04'},results:{ignored:{status:'fail'}}};
 const results=[{id:'test-plant-1::AC-001',plantId:plant.id,checkId:'AC-001',value:{status:'pass',note:'ok'}},
                {id:'test-plant-1::WR-001',plantId:plant.id,checkId:'WR-001',value:{status:'fail',note:'issue'}}];
 await s.saveState(plant,results,plant.id);
 const stored=await s.one('projects',plant.id);
 assert.equal(stored.name,'Plant');assert.equal(stored.results,undefined,'Project must not embed results');
 assert.equal((await s.byPlant('results',plant.id)).length,2);
 const original=new Blob(['This is binary photo data'],{type:'image/jpeg'});
 const saved=await s.storeMedia(plant.id,'AC-001',original,{id:'photo-001',kind:'photo'});
 assert.equal(saved.id,'photo-001');
 assert.equal(await (await s.one('media','photo-001')).blob.text(),'This is binary photo data');
 await s.saveState({...plant,name:'Renamed plant'},[results[0]],plant.id);
 assert.equal((await s.byPlant('results',plant.id)).length,2,'Unchanged result must remain');
 s.close();await s.open();
 assert.equal((await s.one('projects',plant.id)).name,'Renamed plant');
 assert.equal((await s.one('media','photo-001')).size,original.size);
 await s.deletePlant(plant.id);
 assert.equal(await s.one('projects',plant.id),undefined);
 assert.equal((await s.byPlant('results',plant.id)).length,0);
 assert.equal((await s.byPlant('media',plant.id)).length,0);
 s.close();
});
test('ZIP roundtrip retains originals, validates CRC and rejects corruption',async()=>{
 const ctx=load('src/backup-v06.js'),zip=ctx.PVBackupV06;
 const manifest={format:'pv-inspection-backup-2',project:{id:'plant-a'},media:[{id:'photo-001',size:16}]};
 const entries=[{name:'manifest.json',blob:JSON.stringify(manifest)},
 {name:'media/photo-001',blob:new Blob(['example JPEG data'],{type:'image/jpeg'})}];
 const result=await zip.create(entries),read=await zip.read(result);
 assert.equal(read.manifest.project.id,'plant-a');
 assert.equal(await read.entries.get('media/photo-001').text(),'example JPEG data');
 const bytes=new Uint8Array(await result.arrayBuffer()),needle=new TextEncoder().encode('example JPEG data');
 let found=-1;for(let i=0;i<bytes.length-needle.length;i++){if(needle.every((b,j)=>bytes[i+j]===b)){found=i;break}}
 assert.ok(found>=0);
 bytes[found]^=0x12;
 await assert.rejects(zip.read(new Blob([bytes])),/checksum mismatch/);
 await assert.rejects(zip.create([{name:'../bad.txt',blob:'bad'}]),/Unsafe archive path/);
});
