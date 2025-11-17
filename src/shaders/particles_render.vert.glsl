#version 300 es
precision highp float;
uniform sampler2D uStateTex;
uniform float uTexSize;
uniform vec2 uResolution;
flat out vec2 vUV;
out vec2 vPosN;
void main(){
// 通过 gl_VertexID 在状态纹理上寻址粒子
int size=int(uTexSize);
int id=gl_VertexID;
int x=id%size;
int y=id/size;
vec2 uv=(vec2(float(x)+0.5,float(y)+0.5))/uTexSize;
vec4 s=texture(uStateTex,uv);
// 将 [0,1] 归一化坐标映射到裁剪空间 [-1,1]
vec2 p=s.xy*2.0-1.0;
gl_Position=vec4(p,0.0,1.0);
// 点大小与热度关联（更热更大），增强层次
float heatBase=0.55*(1.0-s.y)+0.45*clamp(s.w*0.8,0.0,1.0);
float heat=clamp(heatBase,0.0,1.0);
float ps=clamp(2.0+heat*8.0,1.0,12.0);
gl_PointSize=ps;
vUV=uv;
vPosN=s.xy;
}