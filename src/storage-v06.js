/* PV Inspection v0.6 — offline storage. v0.5 databases are deliberately left untouched.
   Uses small project/result records and independent binary Blob media. */
(function(root){
'use strict';
const NAME='pv-inspection-v06',VERSION=1;
let connection=null,opening=null;
const stores={
 projects:{keyPath:'id'},
 results:{keyPath:'id',indexes:['plantId','checkId','targetId']},
 media:{keyPath:'id',indexes:['plantId','resultId']},
 settings:{keyPath:'key'}
};
function openFresh(){return new Promise((resolve,reject)=>{
 const req=indexedDB.open(NAME,VERSION);
 req.onupgradeneeded=()=>{
  const db=req.result;
  for(const [name,desc] of Object.entries(stores)){
   const os=db.objectStoreNames.contains(name)?req.transaction.objectStore(name):db.createObjectStore(name,{keyPath:desc.keyPath});
   for(const index of desc.indexes||[])if(!os.indexNames.contains(index))os.createIndex(index,index,{unique:false});
  }
 };
 req.onsuccess=()=>{const db=req.result;db.onclose=()=>{if(connection===db)connection=null};db.onversionchange=()=>{db.close();if(connection===db)connection=null};resolve(db)};
 req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'));
 req.onblocked=()=>reject(new Error('IndexedDB blocked by another tab'));
})}
async function open(){if(connection)return connection;if(!opening)opening=openFresh().then(db=>(connection=db,db)).finally(()=>{opening=null});return opening}
async function transaction(storeNames,mode,work){
 for(let attempt=0;attempt<2;attempt++){
  const db=await open();
  try{return await new Promise((resolve,reject)=>{
   let tx;try{tx=db.transaction(storeNames,mode)}catch(e){reject(e);return}
   let result;tx.oncomplete=()=>resolve(result);
   tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
   try{const req=work(tx);if(req)req.onsuccess=()=>{result=req.result}}catch(e){try{tx.abort()}catch(_){}reject(e)}
  })}catch(e){
   const closed=e?.name==='InvalidStateError'||/connection is closing|connection is closed|database is closing/i.test(e?.message||'');
   if(!closed||attempt)throw e;
   if(connection===db)connection=null;
   try{db.close()}catch(_){}
  }
 }
}
function one(store,key){return transaction([store],'readonly',tx=>tx.objectStore(store).get(key))}
function all(store){return transaction([store],'readonly',tx=>tx.objectStore(store).getAll())}
function byPlant(store,plantId){return transaction([store],'readonly',tx=>tx.objectStore(store).index('plantId').getAll(plantId))}
function saveState(plant,changes,currentId){
 if(!plant||!plant.id)throw new TypeError('Plant needs an id');
 const metadata={...plant};delete metadata.results;
 return transaction(['projects','results','settings'],'readwrite',tx=>{
  tx.objectStore('projects').put(metadata);
  for(const r of changes)tx.objectStore('results').put(r);
  tx.objectStore('settings').put({key:'current',id:currentId||plant.id});
 });
}
function storeMedia(plantId,resultId,blob,info={}){
 if(!plantId||!resultId||!(blob instanceof Blob))throw new TypeError('Invalid evidence');
 const id=info.id||crypto.randomUUID();
 const record={...info,id,plantId,resultId,blob,mime:blob.type||info.mime||'application/octet-stream',size:blob.size,at:info.at||new Date().toISOString()};
 return transaction(['media'],'readwrite',tx=>tx.objectStore('media').put(record)).then(()=>({id,mime:record.mime,size:record.size,at:record.at}));
}
function removeMedia(id){return transaction(['media'],'readwrite',tx=>tx.objectStore('media').delete(id))}
function saveSetting(key,value){return transaction(['settings'],'readwrite',tx=>tx.objectStore('settings').put({key,value}))}
function deletePlant(id){return transaction(['projects','results','media'],'readwrite',tx=>{
 tx.objectStore('projects').delete(id);
 // For explicit deletion only; callers must confirm. IDB cursors remain in same transaction.
 for(const name of ['results','media']){
  const cursor=tx.objectStore(name).index('plantId').openKeyCursor(IDBKeyRange.only(id));
  cursor.onsuccess=()=>{const c=cursor.result;if(c){tx.objectStore(name).delete(c.primaryKey);c.continue()}};
 }
})}
function close(){if(connection){connection.close();connection=null}}
root.PVStorageV06=Object.freeze({NAME,VERSION,open,close,transaction,one,all,byPlant,saveState,storeMedia,removeMedia,saveSetting,deletePlant});
})(typeof window!=='undefined'?window:globalThis);
