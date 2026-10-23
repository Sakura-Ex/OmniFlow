import fs from 'node:fs'
import { createServer } from 'vite'
const server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
try {
 const {splitterFixture}=await server.ssrLoadModule('/fixtures/compiler/splitterCases.ts')
 const original=JSON.parse(fs.readFileSync('fixtures/canvas/baseline.json','utf8'))
 for(const mode of ['splitter','splitter-blocked','splitter-spill','splitter-capacity','splitter-zero']){
  const input=splitterFixture()
  if(['splitter-blocked','splitter-spill','splitter-zero'].includes(mode)){
   input.nodes=input.nodes.filter(n=>n.id!=='u');input.edges=input.edges.filter(e=>e.target!=='u');delete input.configuration.ports[JSON.stringify(['u','u'])]
  }
  if(mode==='splitter-spill') input.configuration.ports[JSON.stringify(['f','b'])]={scopeId:'document',busId:'default',semantics:{kind:'flow'},boundary:{kind:'spill',capacity:null}}
  if(mode==='splitter-capacity')input.nodes.find(n=>n.id==='f').data.capacity=2.5
  if(mode==='splitter-zero'){const f=input.nodes.find(n=>n.id==='f');f.data.outputs[0].ratio=1;f.data.outputs[1].ratio=0}
  for(const n of input.nodes)n.position={x:n.id==='s'?0:n.id==='f'?300:630,y:n.id==='u'?400:100}
  const doc={...original,networkConfiguration:input.configuration,domain:{...original.domain,recipes:{}},ui:{...original.ui,nodes:input.nodes,edges:input.edges}}
  fs.writeFileSync('fixtures/canvas/'+mode+'.json',JSON.stringify(doc,null,2))
 }
}finally{await server.close()}
