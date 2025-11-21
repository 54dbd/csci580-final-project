/*
 * 平流着色器（Advection Shader）
 * 
 * 实现半拉格朗日平流方法（Semi-Lagrangian Advection）
 * 这是流体模拟的核心算法，用于让标量场（密度、温度等）随速度场移动
 * 
 * 算法原理：
 * 1. 从当前像素位置回溯，找到在 dt 时间前该位置的值来自哪里
 * 2. 使用速度场计算回溯位置：coord = current_pos - velocity * dt
 * 3. 在回溯位置采样源场，得到新的值
 * 4. 应用耗散（dissipation）模拟粘性和数值耗散
 * 
 * 注意：此着色器假设支持线性纹理过滤（LINEAR），
 * 如果不支持，应使用 advectionManualFilteringShader.glsl
 */

precision highp float;
precision mediump sampler2D;

varying vec2 vUv;                    // 当前像素的 UV 坐标 [0,1]
uniform sampler2D uVelocity;         // 速度场纹理（RG 格式：R=vx, G=vy）
uniform sampler2D uSource;           // 源场纹理（要平流的场：密度、温度等）
uniform vec2 texelSize;              // 纹理像素大小 (1/width, 1/height)
uniform float dt;                    // 时间步长（秒）
uniform float dissipation;           // 耗散系数 [0,1]，模拟粘性和数值耗散

void main () {
  // 半拉格朗日方法：从当前位置回溯，找到来源位置
  // coord = 当前位置 - 速度 * 时间步长
  // 注意：速度需要乘以 texelSize 转换为纹理坐标空间
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  
  // 在回溯位置采样源场（使用线性过滤进行插值）
  // 应用耗散：每帧值会衰减，模拟粘性损失
  gl_FragColor = dissipation * texture2D(uSource, coord);
  gl_FragColor.a = 1.0; // 保持 alpha 通道为 1.0
}
