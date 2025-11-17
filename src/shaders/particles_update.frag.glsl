#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uStateTex;
uniform float uDelta;
uniform float uTime;
uniform float uTexSize;
uniform float uForceUp;
uniform float uDamping;
uniform float uNoise;
uniform float uVyMax;
uniform float uSpawn;
uniform sampler2D uVelTex;
uniform sampler2D uTempTex;
out vec4 outColor;
vec2 h(vec2 p){float s=sin(dot(p,vec2(12.9898,78.233)));return vec2(fract(s*43758.5453),fract(s*12345.6789));}
void main(){
vec4 s=texture(uStateTex,vUV);
vec2 pos=s.xy;
vec2 vel=s.zw;
vec2 rnd=h(vUV+uTime*0.1);
vec2 vfield=texture(uVelTex,pos).xy;
float T=texture(uTempTex,pos).r;
float w=sin(dot(pos*vec2(23.3,17.7),vec2(12.9898,78.233))+uTime*1.3);
vel=vfield + vec2((rnd.x-0.5)*uNoise + w*uNoise*0.3,0.0);
vel*=uDamping;
float limY=uVyMax*(0.7+0.6*h(vUV+uTime*0.03).x);
vel.x=clamp(vel.x,-0.25,0.25);
vel.y=clamp(vel.y,-0.2,limY);
pos+=vel*uDelta;
float rr=h(vUV+floor(uTime*60.0)).y;
bool ignite=rr<uSpawn;
bool respawn=pos.y>1.2||pos.x<-0.1||pos.x>1.1||pos.y<-0.2;
if(respawn){
vec2 r=h(vUV+uTime*2.0);
float spread=0.08;
pos=vec2(0.5+(r.x-0.5)*spread,0.02+r.y*0.02);
vel=vec2((r.x-0.5)*0.08,0.35+r.y*0.2);
}
if(ignite){
 vec2 r=h(vUV+uTime*3.7);
 float spread=0.08;
 pos=vec2(0.5+(r.x-0.5)*spread,0.02+r.y*0.02);
 vel=vec2((r.x-0.5)*0.08,0.35+r.y*0.2);
}
outColor=vec4(pos,vel);
}