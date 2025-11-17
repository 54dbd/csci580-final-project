#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uVelSrc;
uniform float uDelta;
uniform float uDiss;
out vec4 outColor;
void main(){
vec2 v=texture(uVelSrc,vUV).xy;
vec2 uv=vUV - uDelta*v;
uv=clamp(uv,vec2(0.0),vec2(1.0));
vec2 adv=texture(uVelSrc,uv).xy;
adv*=uDiss;
outColor=vec4(adv,0.0,0.0);
}