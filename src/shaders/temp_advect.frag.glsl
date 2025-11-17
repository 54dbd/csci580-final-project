#version 300 es
precision highp float;

// 温度对流：由速度场驱动的半拉格朗日回溯 + 底部热源注入 + 基线上升项
in vec2 vUV;
uniform sampler2D uTempSrc;     // 上一帧温度
uniform sampler2D uVelTex;      // 当前速度场
uniform float uDelta;           // 时间步长
uniform float uDissT;           // 温度耗散
uniform float uSrcIntensity;    // 热源强度
uniform vec2 uSourceCenter;     // 热源中心
uniform float uSourceRadius;    // 热源半径
uniform float uTime;            // 时间
uniform float uUpBase;          // 基线上升速度
out vec4 outColor;

float hash(vec2 p){
  return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);
}

void main(){
  // 回溯坐标：速度场 + 基线上升项
  vec2 v=texture(uVelTex,vUV).xy;
  vec2 uv=vUV - uDelta*(v + vec2(0.0,uUpBase));
  uv=clamp(uv,vec2(0.0),vec2(1.0));

  // 温度采样与衰减
  float t=texture(uTempSrc,uv).r;

  // 高斯热源（底部中心），带轻微闪烁
  vec2 d=vUV - uSourceCenter;
  float m=exp(-dot(d,d)/(uSourceRadius*uSourceRadius));
  float flick=0.7+0.3*hash(vUV+uTime*0.3);
  float add=uSrcIntensity*m*flick;

  float nt=t*uDissT + add;
  outColor=vec4(nt,0.0,0.0,0.0);
}