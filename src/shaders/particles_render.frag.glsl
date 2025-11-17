#version 300 es
precision highp float;
uniform float uTime;
uniform sampler2D uTempTex;
uniform float uWarmth;
uniform float uBrightness;
flat in vec2 vUV;
in vec2 vPosN;
out vec4 outColor;
void main(){
vec2 c=gl_PointCoord*2.0-1.0;
float r=dot(c,c);
if(r>1.0) discard;
float heat=texture(uTempTex,vPosN).r;
heat=clamp(heat*uWarmth,0.0,1.0);
float intensity=pow(heat,2.0);
float a=exp(-3.0*r)*0.4*intensity;
vec3 c0=vec3(0.0);
vec3 c1=vec3(0.8,0.1,0.0);
vec3 c2=vec3(1.0,0.5,0.0);
vec3 c3=vec3(1.0,0.9,0.2);
vec3 c4=vec3(1.0,0.92,0.75);
vec3 col=heat<0.25?mix(c0,c1,heat/0.25):heat<0.5?mix(c1,c2,(heat-0.25)/0.25):heat<0.75?mix(c2,c3,(heat-0.5)/0.25):mix(c3,c4,(heat-0.75)/0.25);
outColor=vec4(col*(a*uBrightness),a);
}