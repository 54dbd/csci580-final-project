/*
 * 燃烧着色器（Combustion Shader）
 * 
 * 模拟燃料燃烧和温度冷却过程：
 * 1. 燃料在达到燃烧温度时转化为热量
 * 2. 温度按照物理规律自然冷却（与温度的四次方成正比，模拟黑体辐射）
 * 
 * 物理模型：
 * - 冷却速率：dT/dt = -cooling * (T/T_burn)^4
 *   这是基于 Stefan-Boltzmann 定律的简化模型
 * - 燃烧：当有燃料时，温度至少等于燃料量 * 燃烧温度
 */

precision highp float;
precision mediump sampler2D;

varying vec2 vUv;                    // 当前像素的 UV 坐标
uniform sampler2D uFuel;              // 燃料场（单通道，值越大燃料越多）
uniform sampler2D uTemperature;       // 温度场（单通道，当前温度值）
uniform sampler2D uNoise;             // 噪声场（可选，用于添加随机性）
uniform vec2 texelSize;               // 纹理像素大小
uniform float dt;                      // 时间步长（秒）
uniform float burnTemperature;         // 燃烧温度阈值（燃料在此温度下燃烧）
uniform float noiseBlending;          // 噪声混合系数（当前未使用）
uniform float cooling;                 // 冷却系数（控制温度下降速度）

/**
 * 计算燃料产生的温度
 * 
 * @param fuel 燃料量 [0,1]
 * @returns 燃料产生的温度
 */
float fuelTemperature (float fuel) {
  return fuel * burnTemperature;
}

void main () {
  // 读取当前温度和燃料值
  float temp = texture2D(uTemperature, vUv).x;
  float fuel = texture2D(uFuel, vUv).x;
  float noise = 2.*(texture2D(uNoise, vUv).x - 0.5); // 零均值噪声 [-1, 1]
  
  // 可选：将噪声混合到燃料中（当前被注释掉）
  // fuel += noise * noiseBlending;
  
  // 步骤 1：冷却现有温度
  // 使用四次方模型模拟黑体辐射冷却
  // 温度越高，冷却越快（符合物理规律）
  // max(0.0, ...) 确保温度不会变为负值
  temp = max(0.0, temp - dt * cooling * pow(temp / burnTemperature, 4.0));
  
  // 步骤 2：添加燃料产生的热量
  // 如果燃料存在，温度至少等于燃料产生的温度
  // 这模拟了燃料燃烧产生热量的过程
  temp = max(temp, fuelTemperature(fuel));
  
  // 输出新温度（只使用 R 通道存储温度值）
  gl_FragColor = vec4(temp, 0.0, 0.0, 1.0);
}
