/*
 * 基础顶点着色器（Base Vertex Shader）
 * 
 * 用于全屏四边形渲染，将归一化设备坐标转换为纹理坐标
 * 同时计算相邻像素的 UV 坐标，用于有限差分计算（如散度、旋度等）
 * 
 * 用途：
 * - 所有片段着色器计算的基础
 * - 提供当前像素和相邻像素的 UV 坐标
 * - 用于实现各种数值方法（有限差分、梯度等）
 */

precision highp float;
precision mediump sampler2D;

attribute vec2 aPosition;             // 顶点位置，范围 [-1.0, -1.0] 到 [1.0, 1.0]（归一化设备坐标）
varying vec2 vUv;                     // 当前像素的 UV 坐标，范围 [0.0, 0.0] 到 [1.0, 1.0]
varying vec2 vL;                      // 左侧相邻像素的 UV 坐标
varying vec2 vR;                      // 右侧相邻像素的 UV 坐标
varying vec2 vT;                      // 上方相邻像素的 UV 坐标
varying vec2 vB;                      // 下方相邻像素的 UV 坐标
uniform vec2 texelSize;               // 纹理像素大小 (1/width, 1/height)

void main () {
  // 将归一化设备坐标 [-1, 1] 转换为纹理坐标 [0, 1]
  // 公式：uv = (ndc + 1) / 2
  vUv = aPosition * 0.5 + 0.5;

  // 计算相邻像素的 UV 坐标
  // 这些坐标用于有限差分计算（如计算梯度、散度、旋度等）
  vL = vUv - vec2(texelSize.x, 0.0);   // 左侧像素（左移一个像素）
  vR = vUv + vec2(texelSize.x, 0.0);   // 右侧像素（右移一个像素）
  vT = vUv + vec2(0.0, texelSize.y);   // 上方像素（上移一个像素）
  vB = vUv - vec2(0.0, texelSize.y);   // 下方像素（下移一个像素）
  
  // 设置顶点位置（直接使用输入位置，因为已经是全屏四边形）
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
