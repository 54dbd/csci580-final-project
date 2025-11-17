#version 300 es
precision highp float;

// 速度施力：涡度约束 + 热浮力，并施加阻尼以保持稳定
in vec2 vUV;
uniform sampler2D uVelSrc;   // 当前速度场
uniform sampler2D uTempTex;  // 当前温度场
uniform float uDelta;        // 时间步长
uniform float uGridSize;     // 栅格大小（用于计算 texel）
uniform float uEps;          // 涡度约束强度
uniform float uBuoy;         // 热浮力系数
uniform float uDamp;         // 阻尼
out vec4 outColor;

void main(){
  float texel=1.0/uGridSize;

  // 邻域速度与涡度（二维情况下 ω = ∂v_y/∂x - ∂v_x/∂y）
  vec2 vC=texture(uVelSrc,vUV).xy;
  vec2 vR=texture(uVelSrc,vUV+vec2(texel,0.0)).xy;
  vec2 vL=texture(uVelSrc,vUV-vec2(texel,0.0)).xy;
  vec2 vU=texture(uVelSrc,vUV+vec2(0.0,texel)).xy;
  vec2 vD=texture(uVelSrc,vUV-vec2(0.0,texel)).xy;
  float w=(vR.y - vL.y)*0.5/texel - (vU.x - vD.x)*0.5/texel;

  // 近似涡度幅值梯度，用于产生指向涡核的归一化法线N
  vec2 grad=vec2(
    (abs(vR.y - vL.y) - abs(texture(uVelSrc,vUV+vec2(-texel,0.0)).y - texture(uVelSrc,vUV+vec2(texel,0.0)).y))*0.5,
    (abs(vU.x - vD.x) - abs(texture(uVelSrc,vUV+vec2(0.0,-texel)).x - texture(uVelSrc,vUV+vec2(0.0,texel)).x))*0.5
  );
  float gmag=max(length(grad),1e-6);
  vec2 N=grad/gmag;

  // 涡度约束力：F_conf = ε * (N⊥) * ω，增强小尺度卷曲
  vec2 fconf=uEps*vec2(N.y,-N.x)*w;

  // 热浮力：正向y方向，与温度正相关
  float T=texture(uTempTex,vUV).r;
  vec2 fbuoy=vec2(0.0,uBuoy*T);

  // 合力更新并施加阻尼
  vec2 v=vC + (fconf+fbuoy)*uDelta;
  v*=uDamp;
  outColor=vec4(v,0.0,0.0);
}