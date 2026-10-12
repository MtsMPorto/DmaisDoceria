import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
async function load(path) {
 const source=readFileSync(new URL(path, import.meta.url),'utf8');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 return import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
}
const {restoreCart}=await load('../src/lib/restoreCart.ts');
const {orderAttemptKey,getOrderAttempt,checkoutGeneration,exclusiveCheckout}=await load('../src/lib/orderAttempt.ts');

function checkoutFixture() {
 const data=new Map();
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 let tail=Promise.resolve();
 const locks={request:(_name,callback)=>{const next=tail.then(callback);tail=next.catch(()=>{});return next;}};
 return {storage,locks};
}
test('two simultaneous tabs submit only once, and a stale tab stays blocked',async()=>{
 const {storage,locks}=checkoutFixture();
 const generation=checkoutGeneration(storage);
 let submissions=0;
 const send=()=>exclusiveCheckout(locks,storage,generation,async()=>{submissions++;await Promise.resolve();return 42;},()=> 'completed');
 const results=await Promise.allSettled([send(),send()]);
 assert.equal(submissions,1);
 assert.equal(results[0].value,42);
 assert.equal(results[1].status,'rejected');
 await assert.rejects(send(),/já foi finalizado/);
 assert.equal(await exclusiveCheckout(locks,storage,checkoutGeneration(storage),async()=>43,()=> 'next'),43);
});
test('a failed request can retry with the same id from another tab',async()=>{
 const {storage,locks}=checkoutFixture();
 const generation=checkoutGeneration(storage);
 const ids=[];
 const send=()=>exclusiveCheckout(locks,storage,generation,async()=>{
  const attempt=getOrderAttempt(storage,'cart',()=> '11111111-1111-4111-8111-111111111111');
  ids.push(attempt.requestId);
  if(ids.length===1) throw Error('network');
  return 42;
 },()=> 'completed');
 await assert.rejects(send(),/network/);
 assert.equal(checkoutGeneration(storage),generation);
 assert.equal(await send(),42);
 assert.equal(ids[0],ids[1]);
});
test('unsupported browsers do not send an unprotected order',async()=>{
 const {storage}=checkoutFixture();
 await assert.rejects(exclusiveCheckout(undefined,storage,'initial',async()=>{assert.fail('must not send');},()=> 'next'),/Atualize seu navegador/);
});
test('restores selections with current catalog and shared stock across flavors',()=>{
 const products=[{id:1,active:true,stock:5,name:'Current',flavors:['A','B']}];
 const restored=restoreCart([{id:1,qty:3,selectedFlavor:'A'},{id:1,qty:4,selectedFlavor:'B'}],products);
 assert.deepEqual(restored.map(i=>i.qty),[3,2]);assert.equal(restored[0].name,'Current');
 assert.deepEqual(restoreCart(restored,products),restored);
});
test('discards unavailable, corrupt and duplicate entries',()=>{
 const products=[{id:1,active:true,stock:5},{id:2,active:false,stock:5}];
 const cart=restoreCart([null,{id:99,qty:1},{id:1,qty:-1},{id:1,qty:1.5},{id:2,qty:1},{id:1,qty:1,selectedFlavor:'Gone'},{id:1,qty:2},{id:1,qty:2}],products);
 assert.equal(cart.length,1);assert.equal(cart[0].qty,2);
 assert.deepEqual(restoreCart(cart,[{...products[0],stock:0}]),[]);
});
test('reopening and retrying preserves the request id; item order does not matter',()=>{
 const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const items=[{productId:2,flavors:[{flavor:null,quantity:2}]},{productId:1,flavors:[{flavor:'B',quantity:1},{flavor:'A',quantity:1}]}];
 const key=orderAttemptKey(7,items);
 assert.equal(key,orderAttemptKey(7,[{...items[1],flavors:[...items[1].flavors].reverse()},items[0]]));
 const first=getOrderAttempt(storage,key,()=> '11111111-1111-4111-8111-111111111111');
 assert.equal(getOrderAttempt(storage,key,()=>{throw Error('Must reuse')}).requestId,first.requestId);
 assert.notEqual(orderAttemptKey(8,items),key);
 data.delete(first.storageKey);
 assert.notEqual(getOrderAttempt(storage,key,()=> '22222222-2222-4222-8222-222222222222').requestId,first.requestId);
});
test('storage failure prevents starting an unprotected request',()=>{
 assert.throws(()=>getOrderAttempt({getItem:()=>null,setItem:()=>{throw Error('blocked')}},'key',()=> '11111111-1111-4111-8111-111111111111'),/blocked/);
});
