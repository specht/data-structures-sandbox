'use strict';
// Arrow geometry shared by the renderers. Every arrow between objects aims at
// the CENTRE of its target and ends exactly where it crosses the target's
// outline, so the tip touches the border and points at the middle, however
// the nodes are placed (rows, trees, curved backward links, animations).
//
// A target is a rounded box {cx, cy, w, h, r}: a node card, a circle
// (w = h = 2r) or a bare point (w = h = 0, the tip ends exactly there).
const ARROW_HEAD=12,ARROW_HALF_WIDTH=5.4;
// About half the outline stroke: the tip touches the outer edge of the border.
const OUTLINE_MARGIN=1;

function boxTarget(x,y,width,height,radius=10){
  return {cx:x+width/2,cy:y+height/2,w:width,h:height,r:radius};
}
function circleTarget(cx,cy,radius){return {cx,cy,w:2*radius,h:2*radius,r:radius};}
function pointTarget(x,y){return {cx:x,cy:y,w:0,h:0,r:0};}
// Pointer animations morph the old target into the new one.
function mixTargets(a,b,t){
  const mix=key=>a[key]+(b[key]-a[key])*t;
  return {cx:mix('cx'),cy:mix('cy'),w:mix('w'),h:mix('h'),r:mix('r')};
}
function insideTarget(target,p){
  const hw=target.w/2+OUTLINE_MARGIN,hh=target.h/2+OUTLINE_MARGIN;
  const r=Math.min(target.r+OUTLINE_MARGIN,hw,hh);
  const dx=Math.abs(p.x-target.cx),dy=Math.abs(p.y-target.cy);
  if(dx>hw||dy>hh)return false;
  const qx=dx-(hw-r),qy=dy-(hh-r);
  return qx<=0||qy<=0||qx*qx+qy*qy<=r*r;
}
const mixPoint=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function cubicPoint([p0,p1,p2,p3],t){
  const a=mixPoint(p0,p1,t),b=mixPoint(p1,p2,t),c=mixPoint(p2,p3,t);
  return mixPoint(mixPoint(a,b,t),mixPoint(b,c,t),t);
}
// The part of the curve between t = 0 and t (de Casteljau).
function cubicPrefix([p0,p1,p2,p3],t){
  const a=mixPoint(p0,p1,t),b=mixPoint(p1,p2,t),c=mixPoint(p2,p3,t);
  const d=mixPoint(a,b,t),e=mixPoint(b,c,t);
  return [p0,a,d,mixPoint(d,e,t)];
}
/**
 * The visible arrow for a cubic curve from [start] to the target's centre
 * (control points [c1], [c2]; omit them for a straight arrow). Returns the
 * shaft path, the head polygon and the tip, or null when the start already
 * lies inside the target (overlapping objects) or the arrow would be tiny.
 */
function arrowGeometry(start,target,c1=null,c2=null){
  const end={x:target.cx,y:target.cy};
  const curve=[start,c1??mixPoint(start,end,1/3),c2??mixPoint(start,end,2/3),end];
  let tipT=1;
  if(target.w>0||target.h>0){
    if(insideTarget(target,start))return null;
    // Walk back from the centre to the outline, then refine by bisection.
    let outside=0,inside=1;
    for(let step=1;step<=64;step++){
      const t=1-step/64;
      if(!insideTarget(target,cubicPoint(curve,t))){outside=t;inside=t+1/64;break;}
    }
    for(let i=0;i<24;i++){
      const t=(outside+inside)/2;
      if(insideTarget(target,cubicPoint(curve,t)))inside=t;else outside=t;
    }
    tipT=outside;
  }
  const tip=cubicPoint(curve,tipT);
  if(Math.hypot(tip.x-start.x,tip.y-start.y)<ARROW_HEAD+2)return null;
  // The shaft stops at the base of the head, one head length before the tip.
  let near=tipT,far=0;
  for(let i=0;i<28;i++){
    const t=(near+far)/2,p=cubicPoint(curve,t);
    if(Math.hypot(p.x-tip.x,p.y-tip.y)>ARROW_HEAD)far=t;else near=t;
  }
  const shaft=cubicPrefix(curve,far),base=shaft[3];
  const length=Math.hypot(tip.x-base.x,tip.y-base.y)||1;
  const ux=(tip.x-base.x)/length,uy=(tip.y-base.y)/length;
  const left={x:base.x-uy*ARROW_HALF_WIDTH,y:base.y+ux*ARROW_HALF_WIDTH};
  const right={x:base.x+uy*ARROW_HALF_WIDTH,y:base.y-ux*ARROW_HALF_WIDTH};
  const [s0,s1,s2,s3]=shaft;
  return {
    tip,
    d:c1==null&&c2==null
      ?`M ${fmt(s0.x)} ${fmt(s0.y)} L ${fmt(s3.x)} ${fmt(s3.y)}`
      :`M ${fmt(s0.x)} ${fmt(s0.y)} C ${fmt(s1.x)} ${fmt(s1.y)}, ${fmt(s2.x)} ${fmt(s2.y)}, ${fmt(s3.x)} ${fmt(s3.y)}`,
    points:`${fmt(tip.x)},${fmt(tip.y)} ${fmt(left.x)},${fmt(left.y)} ${fmt(right.x)},${fmt(right.y)}`,
  };
}
/** Draws a makeArrow() group towards [target]; returns the tip or null. */
function drawArrowTo(group,start,target,c1=null,c2=null){
  const geometry=arrowGeometry(start,target,c1,c2);
  group.setAttribute('visibility',geometry?'visible':'hidden');
  if(!geometry)return null;
  group.querySelector('.arrow-shaft').setAttribute('d',geometry.d);
  group.querySelector('.arrow-tip').setAttribute('points',geometry.points);
  return geometry.tip;
}
// Distance from the target's centre to its outline in direction (ux, uy).
function outlineDistance(target,ux,uy){
  if(target.w===0&&target.h===0)return 0;
  let inside=0,outside=Math.hypot(target.w,target.h)/2+OUTLINE_MARGIN+1;
  for(let i=0;i<24;i++){
    const m=(inside+outside)/2;
    if(insideTarget(target,{x:target.cx+ux*m,y:target.cy+uy*m}))inside=m;else outside=m;
  }
  return outside;
}
// For curved arrows that arrive from a fixed direction (unit vector, e.g.
// {x:1,y:0} = from the left): the point where that straight approach to the
// centre meets the outline, and a control point on the same line, so the
// curve ends straight at the outline and its head points at the centre.
function approachTarget(target,direction){
  const distance=outlineDistance(target,-direction.x,-direction.y);
  return pointTarget(target.cx-direction.x*distance,target.cy-direction.y*distance);
}
function approachControl(target,direction,reach=null,alignedAt=null){
  const entry=approachTarget(target,direction);
  // Either a fixed distance back along the approach, or the point of the
  // approach line at a given coordinate (x for vertical, y for horizontal).
  if(alignedAt!=null)return direction.x===0?{x:entry.cx,y:alignedAt}:{x:alignedAt,y:entry.cy};
  return {x:entry.cx-direction.x*reach,y:entry.cy-direction.y*reach};
}
/** A line (no head) between two outlines, aimed centre to centre. */
function centreLine(from,to){
  const dx=to.cx-from.cx,dy=to.cy-from.cy,length=Math.hypot(dx,dy);
  if(length<.001)return null;
  const ux=dx/length,uy=dy/length;
  const a=outlineDistance(from,ux,uy),b=outlineDistance(to,-ux,-uy);
  if(a+b>=length)return null;
  return {x1:fmt(from.cx+ux*a),y1:fmt(from.cy+uy*a),x2:fmt(to.cx-ux*b),y2:fmt(to.cy-uy*b)};
}
