#version 300 es
precision highp float;
uniform float uTime;
uniform sampler2D uTempTex;
uniform float uWarmth;
uniform float uBrightness;
uniform float uGamma;
uniform float uLowCut;
uniform float uHighCut;
flat in vec2 vUV;
in vec2 vPosN;
out vec4 outColor;
void main(){
// 点精灵圆形遮罩与径向衰减（越靠中心越亮）
vec2 c=gl_PointCoord*2.0-1.0;
float r=dot(c,c);
if(r>1.0) discard;

// 热度采样并做区间压缩+Gamma映射，扩大红橙层次
float heat=texture(uTempTex,vPosN).r;
heat=clamp(heat*uWarmth,0.0,1.0);
float hn=clamp((heat - uLowCut)/max(1e-5,uHighCut - uLowCut),0.0,1.0);
float intensity=pow(hn,uGamma);
float a=exp(-3.0*r)*0.4*intensity;

// 颜色LUT：黑→红→橙→黄→近白
vec3 c0=vec3(0.0);
vec3 c1=vec3(0.7,0.05,0.0);
vec3 c2=vec3(1.0,0.35,0.0);
vec3 c3=vec3(1.0,0.82,0.1);
vec3 c4=vec3(1.0,0.93,0.7);
vec3 col=hn<0.25?mix(c0,c1,hn/0.25):hn<0.5?mix(c1,c2,(hn-0.25)/0.25):hn<0.75?mix(c2,c3,(hn-0.5)/0.25):mix(c3,c4,(hn-0.75)/0.25);

// 亮度缩放，并使用加色混合在屏幕上累加
outColor=vec4(col*(a*uBrightness),a);
}