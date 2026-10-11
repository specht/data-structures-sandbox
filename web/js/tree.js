'use strict';
// Binary trees (BST, AVL, node heap): layout, edges and node retirement.
// v1.0: structure-specific renderers consume the same operation/source timeline.
// A tree changes left/right pointers; a fixed array changes indexed cells.
function treeLayout(snapshot){
  const byId=new Map(snapshot.nodes.map(n=>[n.id,n]));
  const targets=new Map(),seen=new Set();
  // A fixed halving offset eventually places cousins on top of each other:
  // 220, 110, 55, 40, 40 ... is not enough for broad/deep AVL subtrees.
  // Measure each subtree's left/right contour at every depth (in logical SVG
  // units), then move siblings apart ONLY as much as required. This is a tidy
  // tree layout: circles at the same depth never collide, even beyond the
  // fixed scene width. Keep the root centred and retain stable node IDs.
  const MIN_SIBLING_GAP=94; // 72px circle + 22px breathing room.
  const BASE_CHILD_OFFSET=72;
  const profiles=new Map();
  const pending=[{id:snapshot.root,finished:false}];
  const discovered=new Set();
  while(pending.length){
    const {id,finished}=pending.pop();
    if(id==null||!byId.has(id))continue;
    if(!finished){
      if(discovered.has(id))continue; // malformed cyclic/shared trees
      discovered.add(id);
      pending.push({id,finished:true});
      const node=byId.get(id);
      pending.push({id:node.right,finished:false});
      pending.push({id:node.left,finished:false});
      continue;
    }
    const node=byId.get(id),left=profiles.get(node.left),right=profiles.get(node.right);
    let dxLeft=left?-BASE_CHILD_OFFSET:0;
    let dxRight=right?BASE_CHILD_OFFSET:0;
    if(left&&right){
      // Each contour entry is a horizontal EXTENT, not an inorder index.
      // Checking all common levels prevents descendants of different parent
      // nodes from overlapping, even if their direct children have room.
      let required=MIN_SIBLING_GAP;
      const sharedDepth=Math.min(left.max.length,right.min.length);
      for(let d=0;d<sharedDepth;d++){
        required=Math.max(required,left.max[d]-right.min[d]+MIN_SIBLING_GAP);
      }
      const extra=Math.max(0,(required-(dxRight-dxLeft))/2);
      dxLeft-=extra;dxRight+=extra;
    }
    const min=[0],max=[0];
    for(const [child,dx] of [[left,dxLeft],[right,dxRight]]){
      if(!child)continue;
      for(let d=0;d<child.min.length;d++){
        const level=d+1,lo=child.min[d]+dx,hi=child.max[d]+dx;
        min[level]=min[level]===undefined?lo:Math.min(min[level],lo);
        max[level]=max[level]===undefined?hi:Math.max(max[level],hi);
      }
    }
    profiles.set(id,{min,max,dxLeft,dxRight});
  }
  const centre=SCENE_WIDTH/2;
  const positions=[{id:snapshot.root,depth:0,cx:centre}];
  while(positions.length){
    const {id,depth,cx}=positions.pop();
    if(id==null||seen.has(id)||!byId.has(id))continue;
    seen.add(id);
    targets.set(id,{x:cx-TREE_RADIUS,y:155+depth*90,opacity:1,detached:false});
    const node=byId.get(id),profile=profiles.get(id);
    if(profile){
      positions.push({id:node.right,depth:depth+1,cx:cx+profile.dxRight});
      positions.push({id:node.left,depth:depth+1,cx:cx+profile.dxLeft});
    }
  }
  let orphan=0;
  for(const item of snapshot.nodes){
    if(targets.has(item.id))continue;
    const previous=nodes.get(item.id),pending=!previous?.wasReachable;
    targets.set(item.id,{x:previous?.x??centre-TREE_RADIUS+orphan*90,
      y:pending?90:530,opacity:pending?1:.32,detached:!pending});orphan++;
  }
  // Intentionally no automatic viewBox changes: zooming every recorded
  // pointer write makes an otherwise smooth rotation appear to jump. Students
  // can use Fit and then zoom/pan to examine a large tree at readable size.
  return {targets,count:seen.size,cycle:false};
}
// Tree edges connect the node centres, clipped to their circular outlines.
// A relaxed tree always has straight edges; a modest Bezier bend is used ONLY
// during pointer changes and node settling, then fades back to a line.
const TREE_RADIUS=36;
let treeEdgeMotion=0;
function treeCentre(node){return {x:node.x+TREE_RADIUS,y:node.y+TREE_RADIUS};}
function drawTreeEdge(group,fromCentre,toCentre,targetRadius=TREE_RADIUS,side='left'){
  const dx=toCentre.x-fromCentre.x,dy=toCentre.y-fromCentre.y;
  const length=Math.hypot(dx,dy);
  if(length<.001){group.setAttribute('visibility','hidden');return;}
  const ux=dx/length,uy=dy/length;
  const start={x:fromCentre.x+ux*(TREE_RADIUS+1),y:fromCentre.y+uy*(TREE_RADIUS+1)};
  const tip={x:toCentre.x-ux*(targetRadius+1),y:toCentre.y-uy*(targetRadius+1)};
  const span=Math.hypot(tip.x-start.x,tip.y-start.y);
  if(span<14){group.setAttribute('visibility','hidden');return;}
  group.setAttribute('visibility','visible');
  const headLength=Math.min(11,span*.4);
  const base={x:tip.x-ux*headLength,y:tip.y-uy*headLength};
  const left={x:base.x-uy*5.2,y:base.y+ux*5.2};
  const right={x:base.x+uy*5.2,y:base.y-ux*5.2};
  const bend=Math.min(28,span*.17)*treeEdgeMotion*(side==='left'?-1:1);
  const c1={x:start.x+(base.x-start.x)*.36-uy*bend,
            y:start.y+(base.y-start.y)*.36+ux*bend};
  // Keep the endpoint tangent collinear with the centre-to-centre vector so
  // the filled triangular tip lands precisely on the target's circular rim.
  const c2={x:base.x-ux*Math.min(20,span*.2),y:base.y-uy*Math.min(20,span*.2)};
  const shaft=treeEdgeMotion<.001
    ?`M ${fmt(start.x)} ${fmt(start.y)} L ${fmt(base.x)} ${fmt(base.y)}`
    :`M ${fmt(start.x)} ${fmt(start.y)} C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(base.x)} ${fmt(base.y)}`;
  group.querySelector('.arrow-shaft').setAttribute('d',shaft);
  group.querySelector('.arrow-tip').setAttribute('points',
    `${fmt(tip.x)},${fmt(tip.y)} ${fmt(left.x)},${fmt(left.y)} ${fmt(right.x)},${fmt(right.y)}`);
}
function treeTargetPoint(id,field,source){
  if(id!=null && nodes.has(id)){
    const c=treeCentre(nodes.get(id));
    const dx=c.x-source.x,dy=c.y-source.y,d=Math.hypot(dx,dy)||1;
    return {x:c.x-dx/d*(TREE_RADIUS+1),y:c.y-dy/d*(TREE_RADIUS+1)};
  }
  return {x:source.x+(field==='left'?-95:95),y:source.y+95};
}
function renderTreeEdges(){
  const active=new Set();
  for(const node of nodes.values()){
    for(const field of ['left','right']){
      const key=`${node.id}:${field}`,name=`node:${node.id}.${field}`;
      const event=override?.from===name?override:null;
      const source=treeCentre(node);
      const to=event?.x!=null?{x:event.x,y:event.y}:
        (node[field]!=null&&nodes.has(node[field])?treeCentre(nodes.get(node[field])):null);
      if(!to)continue;
      active.add(key);
      let edge=links.get(key);if(!edge){edge=makeArrow('edge');ui.edges.append(edge);links.set(key,edge);}
      drawTreeEdge(edge,source,to,event?0:TREE_RADIUS,field);
      edge.setAttribute('opacity',Math.min(1,node.opacity*(nodes.get(node[field])?.opacity??1)).toFixed(3));
      edge.classList.toggle('hot',hotLink===name);
    }
  }
  for(const [key,edge] of links)if(!active.has(key)){edge.remove();links.delete(key);}
}
function retireNodes(ids){
  for(const id of ids){nodes.delete(id);nodeViews.get(id)?.remove();nodeViews.delete(id);}
  renderAll();
}
async function animateRetire(ids,snapshot){
  references={}; // The method has returned: local variables are out of scope.
  ui.phase.textContent='UNREACHABLE';ui.status.textContent='No remaining references: detached objects fade from the diagram.';
  const beginning=ids.map(id=>({id,node:nodes.get(id),y:nodes.get(id)?.y??0,opacity:nodes.get(id)?.opacity??0}));
  await tween(520,t=>{
    for(const {node,y,opacity} of beginning){if(!node)continue;node.y=lerp(y,y+45,t);node.opacity=lerp(opacity,0,t);node.detached=true;}
    renderAll();
  });
  retireNodes(ids);applySnapshot(snapshot);
}
