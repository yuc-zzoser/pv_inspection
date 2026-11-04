/* PV Inspection v0.6 — uncompressed ZIP writer and constrained ZIP reader.
 * ZIP entries: manifest.json and media/<uuid>. Includes CRC32 and checks on import.
 * ZIP32 limit: individual files and archive under 4 GiB. */
(function(root){
'use strict';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0}
function crc32Step(crc,bytes){for(let i=0;i<bytes.length;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);return crc}
async function crc32(blob){let crc=0xffffffff;for(let start=0;start<blob.size;start+=1048576){crc=crc32Step(crc,new Uint8Array(await blob.slice(start,start+1048576).arrayBuffer()))}return (crc^0xffffffff)>>>0}
function header(length){return new DataView(new ArrayBuffer(length))}
function set32(v,o,n){v.setUint32(o,n>>>0,true)}
function set16(v,o,n){v.setUint16(o,n,true)}
function fail(msg){throw new Error(msg)}
async function create(entries){
 let parts=[],directory=[],offset=0;
 for(const item of entries){
  if(!/^(manifest\.json|media\/[a-zA-Z0-9._-]+)$/.test(item.name))fail('Unsafe archive path');
  const name=encoder.encode(item.name),blob=item.blob instanceof Blob?item.blob:new Blob([item.blob]);
  if(name.length>65535||blob.size>=0xffffffff)fail('ZIP entry too large');
  const crc=await crc32(blob),loc=header(30);
  set32(loc,0,0x04034b50);set16(loc,4,20);set16(loc,6,0x0800);
  set16(loc,8,0);set32(loc,14,crc);set32(loc,18,blob.size);set32(loc,22,blob.size);set16(loc,26,name.length);
  parts.push(loc.buffer,name,blob);
  directory.push({name,size:blob.size,crc,offset});
  offset+=30+name.length+blob.size;
  if(offset>=0xffffffff)fail('ZIP archive exceeds 4 GiB');
 }
 const centralStart=offset;
 for(const e of directory){
  const v=header(46);set32(v,0,0x02014b50);set16(v,4,20);set16(v,6,20);set16(v,8,0x0800);
  set32(v,16,e.crc);set32(v,20,e.size);set32(v,24,e.size);set16(v,28,e.name.length);set32(v,42,e.offset);
  parts.push(v.buffer,e.name);offset+=46+e.name.length;
 }
 if(directory.length>65535||offset>=0xffffffff)fail('ZIP too large');
 const end=header(22);set32(end,0,0x06054b50);set16(end,8,directory.length);set16(end,10,directory.length);
 set32(end,12,offset-centralStart);set32(end,16,centralStart);parts.push(end.buffer);
 return new Blob(parts,{type:'application/zip'});
}
async function read(file){
 if(!(file instanceof Blob)||file.size<22)fail('Invalid archive');
 const tailOffset=Math.max(0,file.size-65557);
 const tail=new Uint8Array(await file.slice(tailOffset).arrayBuffer());
 let endAt=-1;for(let i=tail.length-22;i>=0;i--){if(tail[i]===0x50&&tail[i+1]===0x4b&&tail[i+2]===0x05&&tail[i+3]===0x06){endAt=i;break}}
 if(endAt<0)fail('ZIP end record missing');
 const end=new DataView(tail.buffer,tail.byteOffset+endAt,22);
 if(end.getUint16(20,true)!==0)fail('ZIP comments not supported');
 const count=end.getUint16(10,true),dirSize=end.getUint32(12,true),dirOffset=end.getUint32(16,true);
 if(dirOffset+dirSize>file.size||count>30000)fail('Invalid ZIP directory');
 const raw=new Uint8Array(await file.slice(dirOffset,dirOffset+dirSize).arrayBuffer()),dv=new DataView(raw.buffer);
 let pos=0;const entries=new Map();
 for(let i=0;i<count;i++){
  if(pos+46>raw.length||dv.getUint32(pos,true)!==0x02014b50)fail('Invalid ZIP directory entry');
  const flags=dv.getUint16(pos+8,true),method=dv.getUint16(pos+10,true);
  if(method!==0||(flags&1))fail('Compressed/encrypted ZIP unsupported');
  const crc=dv.getUint32(pos+16,true),size=dv.getUint32(pos+24,true),compressed=dv.getUint32(pos+20,true);
  const nameLen=dv.getUint16(pos+28,true),extra=dv.getUint16(pos+30,true),comment=dv.getUint16(pos+32,true),localOffset=dv.getUint32(pos+42,true);
  if(size!==compressed||pos+46+nameLen+extra+comment>raw.length)fail('Invalid ZIP entry size');
  const name=decoder.decode(raw.slice(pos+46,pos+46+nameLen));
  if(!/^(manifest\.json|media\/[a-zA-Z0-9._-]+)$/.test(name)||entries.has(name))fail('Invalid or duplicate ZIP entry');
  const local=new DataView(await file.slice(localOffset,localOffset+30).arrayBuffer());
  if(local.byteLength!==30||local.getUint32(0,true)!==0x04034b50)fail('ZIP local header invalid');
  const dataStart=localOffset+30+local.getUint16(26,true)+local.getUint16(28,true);
  if(dataStart+size>dirOffset)fail('ZIP entry overlaps directory');
  const blob=file.slice(dataStart,dataStart+size);
  if(await crc32(blob)!==crc)fail('ZIP checksum mismatch: '+name);
  entries.set(name,blob);
  pos+=46+nameLen+extra+comment;
 }
 if(pos!==raw.length||!entries.has('manifest.json'))fail('Invalid ZIP contents');
 const manifest=JSON.parse(await entries.get('manifest.json').text());
 return {manifest,entries};
}
root.PVBackupV06=Object.freeze({create,read,crc32});
})(typeof window!=='undefined'?window:globalThis);
