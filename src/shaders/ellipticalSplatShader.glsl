/*
 * 椭圆溅射着色器（Elliptical Splat Shader）
 * 
 * 创建椭圆形的溅射效果，支持不同的长轴和短轴半径
 * 用于创建边缘燃烧区域
 */

precision highp float;
precision mediump sampler2D;

varying vec2 vUv;
uniform sampler2D uTarget; // 目标纹理
uniform float aspectRatio; // 画布宽高比
uniform vec3 color;        // 溅射颜色
uniform vec2 point;        // 溅射中心点
uniform vec2 radius;       // 椭圆半径 (radiusX, radiusY)
uniform bool useMax;       // 如果为 true，使用最大值混合，否则使用加法混合

void main () {
  // 计算到中心点的距离
  vec2 p = vUv - point.xy;
  p.x *= aspectRatio;
  
  // 椭圆距离计算：使用不同的半径在 X 和 Y 方向
  // 椭圆方程：(x/rx)^2 + (y/ry)^2 = 1
  vec2 normalizedP = vec2(p.x / radius.x, p.y / radius.y);
  float distSq = dot(normalizedP, normalizedP);
  
  // 高斯溅射：exp(-距离^2)
  vec3 splat = exp(-distSq) * color;
  
  // 读取基础值
  vec3 base = texture2D(uTarget, vUv).xyz;
  
  // 根据 useMax 选择混合方式
  if (useMax) {
    gl_FragColor = vec4(max(base, splat), 1.0);
  } else {
    gl_FragColor = vec4(base + splat, 1.0);
  }
}

