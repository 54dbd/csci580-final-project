#version 300 es
precision highp float;

// 每像素输入：全屏四边形顶点着色器传入的UV坐标
in vec2 vUV;

// 粒子状态纹理：RGBA32F，xy=位置，zw=速度
uniform sampler2D uStateTex;

// 时间步长（秒）、绝对时间（秒）、粒子贴图尺寸（用于派生随机）
uniform float uDelta;
uniform float uTime;
uniform float uTexSize;

// 行为参数：上升力强度、阻尼、横向噪声、最大上升速度
uniform float uForceUp;
uniform float uDamping;
uniform float uNoise;
uniform float uVyMax;

// 持续点火概率（每帧）：决定底部重生的频率
uniform float uSpawn;

// 栅格场：速度场与温度场（粒子运动与着色均由此驱动）
uniform sampler2D uVelTex;
uniform sampler2D uTempTex;

// 输出新的粒子状态
out vec4 outColor;

// 简易哈希噪声（用于扰动与随机重生）
vec2 h(vec2 p){
  float s=sin(dot(p,vec2(12.9898,78.233)));
  return vec2(fract(s*43758.5453),fract(s*12345.6789));
}

void main(){
  // 读取当前状态
  vec4 s=texture(uStateTex,vUV);
  vec2 pos=s.xy;
  vec2 vel=s.zw;

  // 采样速度场并加入小幅横向随机与涡动扰动
  vec2 rnd=h(vUV+uTime*0.1);
  vec2 vfield=texture(uVelTex,pos).xy;
  float w=sin(dot(pos*vec2(23.3,17.7),vec2(12.9898,78.233))+uTime*1.3);
  vel = vfield + vec2((rnd.x-0.5)*uNoise + w*uNoise*0.3, 0.0);

  // 速度阻尼与夹取（限制极端速度）
  vel*=uDamping;
  float limY=uVyMax*(0.7+0.6*h(vUV+uTime*0.03).x);
  vel.x=clamp(vel.x,-0.25,0.25);
  vel.y=clamp(vel.y,-0.2,limY);

  // 位置积分
  pos+=vel*uDelta;

  // 边界处理：
  // - 左右环绕，避免瞬时越界死亡
  // - 顶部轻微反弹，延长生命周期
  if(pos.x<0.0) pos.x+=1.0;
  if(pos.x>1.0) pos.x-=1.0;
  if(pos.y>1.05){ pos.y=1.05; vel.y=-0.05; }

  // 底部越界时重生（其余边界不再立即死亡）
  bool respawn=pos.y<-0.2;

  if(respawn){
    vec2 r=h(vUV+uTime*2.0);
    float spread=0.08;
    pos=vec2(0.5+(r.x-0.5)*spread,0.02+r.y*0.02);
    vel=vec2((r.x-0.5)*0.08,0.35+r.y*0.2);
  }

  // 持续点火：按帧概率在底部注入新粒子（提升可调试性）
  float rr=h(vUV+floor(uTime*60.0)).y;
  bool ignite=rr<uSpawn;
  if(ignite){
    vec2 r=h(vUV+uTime*3.7);
    float spread=0.08;
    pos=vec2(0.5+(r.x-0.5)*spread,0.02+r.y*0.02);
    vel=vec2((r.x-0.5)*0.08,0.35+r.y*0.2);
  }

  outColor=vec4(pos,vel);
}