/*
 * 浮力着色器（Buoyancy Shader）
 * 
 * 模拟热浮力效应：热空气密度小，受到向上的浮力
 * 这是火焰上升的主要原因
 * 
 * 物理原理：
 * - 温度越高，浮力越大
 * - 浮力方向：向上（Y 轴正方向）
 * - 浮力大小：与温度成正比
 * 
 * 实现：
 * - 根据温度计算浮力冲量（impulse）
 * - 将浮力冲量添加到速度场
 */

precision highp float;
precision mediump sampler2D;

varying vec2 vUv;                    // 当前像素的 UV 坐标
uniform sampler2D uVelocity;         // 速度场（RG 格式：R=vx, G=vy）
uniform sampler2D uTemperature;     // 温度场（单通道）
uniform vec2 texelSize;               // 纹理像素大小
uniform float dt;                     // 时间步长（秒）
uniform float buoyancy;               // 浮力参数（控制浮力强度）

void main () {
  // 读取当前温度值
  float dTemp = texture2D(uTemperature, vUv).x;
  
  // 计算浮力冲量
  // 浮力方向：向上（vec2(0.0, 1.0) 表示 Y 轴正方向）
  // 浮力大小：与温度成正比，乘以浮力参数和时间步长
  vec2 impulse = dt * buoyancy * dTemp * vec2(0.0, 1.0);
  
  // 读取当前速度
  vec2 vel = texture2D(uVelocity, vUv).xy;
  
  // 将浮力冲量添加到速度
  // 新速度 = 旧速度 + 浮力冲量
  gl_FragColor = vec4(vel + impulse, 0.0, 1.0);
}
