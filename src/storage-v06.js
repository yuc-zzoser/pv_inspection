/* PV Inspection V0.6 — experimental storage layer.
 * Deliberately isolated from pv-field-db (V0.5.x).
 * No UI wiring yet. Data are not migrated implicitly. */
(function(root){
'use strict';
const DB_NAME='pv-inspection-v06',DB_VERSION=1;
const definitions={
 plants:{keyPath:'id'},
 locations:{keyPath:'id',indexes:['plantId']},
 assets:{keyPath:'id',indexes:['plantId','locationId']},
 assetRelations:{keyPath:'id',indexes:['plantId']},
 sessions:{keyPath:'id',indexes:['plantId']},
 routeTemplates:{keyPath:'id',indexes:['plantId']},
 executions:{keyPath:'id',indexes:['plantId','checkId','locationId']},
 findings:{keyPath:'id',indexes:['plantId']},
 evidence:{keyPath:'id',indexes:['plantId','executionId']},
 checkOverrides:{keyPath:'id',indexes:['plantId','checkId']},
 settings:{keyPath:'key'}
};
function uuid(){return crypto.randomUUID()}
function open(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{
   const db=request.result;
   for(const [name,def] of Object.entries(definitions)){
    const store=db.objectStoreNames.contains(name)?request.transaction.objectStore(name):db.createObjectStore(name,{keyPath:def.keyPath});
    for(const field of def.indexes||[])if(!store.indexNames.contains(field))store.createIndex(field,field,{unique:false});
   }
  };
  request.onsuccess=()=>{
   const db=request.result;
   db.onversionchange=()=>db.close();
   resolve(db);
  };
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(new Error('Database upgrade blocked by another tab'));
 });
}
function transact(db,stores,mode,operation){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(stores,mode);
  let value,settled=false;
  tx.oncomplete=()=>{settled=true;resolve(value)};
  tx.onabort=()=>{if(!settled)reject(tx.error||new Error('Transaction aborted'))};
  tx.onerror=()=>{ /* onabort carries terminal error */ };
  try{const request=operation(tx);
   if(request)request.onsuccess=()=>{value=request.result};
  }catch(e){try{tx.abort()}catch(_){} reject(e)}
 });
}
function put(db,store,record){
 if(!definitions[store])throw new Error('Unknown store: '+store);
 return transact(db,[store],'readwrite',tx=>tx.objectStore(store).put(record));
}
function get(db,store,key){
 if(!definitions[store])throw new Error('Unknown store: '+store);
 return transact(db,[store],'readonly',tx=>tx.objectStore(store).get(key));
}
function byIndex(db,store,index,key){
 if(!definitions[store]?.indexes?.includes(index))throw new Error('Unknown index');
 return transact(db,[store],'readonly',tx=>tx.objectStore(store).index(index).getAll(key));
}
function putEvidence(db,metadata,blob){
 if(!(blob instanceof Blob))throw new TypeError('Evidence must be a Blob');
 if(!metadata?.plantId||!metadata?.executionId)throw new TypeError('Evidence requires plantId and executionId');
 const id=metadata.id||uuid();
 const record={...metadata,id,blob,size:blob.size,mime:blob.type||metadata.mime||'application/octet-stream',created:metadata.created||new Date().toISOString()};
 return put(db,'evidence',record).then(()=>({id,size:record.size,mime:record.mime}));
}
function saveExecutionWithEvidence(db,execution,metadata,blob){
 if(!execution?.id||!execution?.plantId||!execution?.checkId)throw new TypeError('Execution requires id, plantId and checkId');
 if(!(blob instanceof Blob))throw new TypeError('Evidence must be a Blob');
 const id=metadata?.id||uuid();
 const evidence={...metadata,id,plantId:execution.plantId,executionId:execution.id,blob,size:blob.size,mime:blob.type||metadata?.mime||'application/octet-stream',created:metadata?.created||new Date().toISOString()};
 return transact(db,['executions','evidence'],'readwrite',tx=>{
  tx.objectStore('executions').put(execution);
  tx.objectStore('evidence').put(evidence);
 }).then(()=>({evidenceId:id}));
}
function checkOverride(plantId,checkId,changes){
 if(!plantId||!checkId)throw new TypeError('plantId and checkId required');
 // Never change identity of the catalog check; overrides are plant-scoped.
 return {...changes,id:plantId+'::'+checkId,plantId,checkId,updated:new Date().toISOString()};
}
root.PVStorageV06=Object.freeze({DB_NAME,DB_VERSION,definitions,open,put,get,byIndex,putEvidence,saveExecutionWithEvidence,checkOverride,uuid});
})(typeof window!=='undefined'?window:globalThis);
