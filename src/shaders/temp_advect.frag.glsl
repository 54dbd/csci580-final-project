#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTempSrc;
uniform sampler2D uVelTex;
uniform float uDelta;
uniform float uDissT;
uniform float uSrcIntensity;
uniform vec2 uSourceCenter;
uniform float uSourceRadius;
uniform float uTime;
uniform float uUpBase;
out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);
}
void main(){
vec2 v=texture(uVelTex,vUV).xy;
vec2 uv=vUV - uDelta*(v + vec2(0.0,uUpBase));
uv=clamp(uv,vec2(0.0),vec2(1.0));
float t=texture(uTempSrc,uv).r;
vec2 d=vUV - uSourceCenter;
float m=exp(-dot(d,d)/(uSourceRadius*uSourceRadius));
float flick=0.7+0.3*hash(vUV+uTime*0.3);
float add=uSrcIntensity*m*flick;
float nt=t*uDissT + add;
outColor=vec4(nt,0.0,0.0,0.0);
}
