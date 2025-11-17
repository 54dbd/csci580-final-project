#version 300 es
precision highp float;

// 半拉格朗日对流：按速度场回溯到上一步的位置采样，稳定且易并行
in vec2 vUV;
uniform sampler2D uVelSrc;  // 速度源纹理（上一帧）
uniform float uDelta;       // 时间步长
uniform float uDiss;        // 耗散系数（<1 逐步衰减）
out vec4 outColor;

void main(){
  // 当前速度与回溯坐标
  vec2 v=texture(uVelSrc,vUV).xy;
  vec2 uv=vUV - uDelta*v;
  uv=clamp(uv,vec2(0.0),vec2(1.0));

  // 在回溯位置采样并施加耗散
  vec2 adv=texture(uVelSrc,uv).xy;
  adv*=uDiss;
  outColor=vec4(adv,0.0,0.0);
}