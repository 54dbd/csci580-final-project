#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uVelSrc;
uniform sampler2D uTempTex;
uniform float uDelta;
uniform float uGridSize;
uniform float uEps;
uniform float uBuoy;
uniform float uDamp;
out vec4 outColor;
void main(){
float texel=1.0/uGridSize;
vec2 vC=texture(uVelSrc,vUV).xy;
vec2 vR=texture(uVelSrc,vUV+vec2(texel,0.0)).xy;
vec2 vL=texture(uVelSrc,vUV-vec2(texel,0.0)).xy;
vec2 vU=texture(uVelSrc,vUV+vec2(0.0,texel)).xy;
vec2 vD=texture(uVelSrc,vUV-vec2(0.0,texel)).xy;
float w=(vR.y - vL.y)*0.5/texel - (vU.x - vD.x)*0.5/texel;
float wR=abs((texture(uVelSrc,vUV+vec2(texel,0.0)).y - texture(uVelSrc,vUV-vec2(texel,0.0)).y)*0.5/texel - (texture(uVelSrc,vUV+vec2(0.0,texel)).x - texture(uVelSrc,vUV-vec2(0.0,texel)).x)*0.5/texel);
float wL=wR;
vec2 grad=vec2((abs(texture(uVelSrc,vUV+vec2(texel,0.0)).y - texture(uVelSrc,vUV-vec2(texel,0.0)).y) - abs(texture(uVelSrc,vUV+vec2(-texel,0.0)).y - texture(uVelSrc,vUV+vec2(texel,0.0)).y))*0.5,
               (abs(texture(uVelSrc,vUV+vec2(0.0,texel)).x - texture(uVelSrc,vUV-vec2(0.0,texel)).x) - abs(texture(uVelSrc,vUV+vec2(0.0,-texel)).x - texture(uVelSrc,vUV+vec2(0.0,texel)).x))*0.5);
float gmag=max(length(grad),1e-6);
vec2 N=grad/gmag;
vec2 fconf=uEps*vec2(N.y,-N.x)*w;
float T=texture(uTempTex,vUV).r;
vec2 fbuoy=vec2(0.0,uBuoy*T);
vec2 v=vC + (fconf+fbuoy)*uDelta;
v*=uDamp;
outColor=vec4(v,0.0,0.0);
}