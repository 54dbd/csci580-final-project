/**
 * WebGL 流体模拟 - 火焰效果系统
 * 
 * 这是一个基于 WebGL 的实时流体动力学模拟系统，实现了火焰、烟雾和流体效果。
 * 使用 GPU 加速的数值方法（如 Navier-Stokes 方程）来模拟流体行为。
 * 
 * 主要特性：
 * - 基于速度场的流体模拟
 * - 温度、燃料和密度的物理模拟
 * - 粒子系统用于火焰效果
 * - 多种调试模式可视化不同物理量
 */

// ============================================================================
// 着色器导入
// ============================================================================
// 导入所有 GLSL 着色器源代码文件
// 这些着色器在 GPU 上执行，用于实现各种物理计算和渲染效果
import addNoiseShaderSource from "./shaders/addNoiseShader.glsl";              // 添加噪声到噪声通道
import advectionManualFilteringShaderSource from "./shaders/advectionManualFilteringShader.glsl"; // 手动过滤的平流（用于不支持线性过滤的设备）
import advectionShaderSource from "./shaders/advectionShader.glsl";            // 平流计算（物质随速度场移动）
import baseVertexShaderSource from "./shaders/baseVertexShader.glsl";          // 基础顶点着色器（全屏四边形）
import buoyancyShaderSource from "./shaders/buoyancyShader.glsl";              // 浮力计算（热空气上升）
import clearShaderSource from "./shaders/clearShader.glsl";                    // 清除/衰减纹理值
import combustionShaderSource from "./shaders/combustionShader.glsl";          // 燃烧计算（燃料转化为温度）
import curlShaderSource from "./shaders/curlShader.glsl";                     // 计算速度场的旋度（用于涡度限制）
import debugFireShaderSource from "./shaders/debugFireShader.glsl";           // 调试模式：显示燃料和温度
import debugFloatShaderSource from "./shaders/debugFloatShader.glsl";         // 调试模式：显示浮点纹理值
import displayShaderSource from "./shaders/displayShader.glsl";              // 标准显示着色器
import displayFireShaderSource from "./shaders/displayFireShader.glsl";        // 火焰显示着色器（最终渲染）
import divergenceShaderSource from "./shaders/divergenceShader.glsl";         // 计算速度场的散度（用于压力投影）
import particlesAdvectionShaderSource from "./shaders/particlesAdvectionShader.glsl"; // 粒子平流（粒子随速度场移动）
import particlesRenderShaderSource from "./shaders/particlesRenderShader.glsl"; // 粒子渲染着色器
import particlesResetDataShaderSource from "./shaders/particlesResetData.glsl"; // 重置粒子位置和速度
import particlesResetLifespanShaderSource from "./shaders/particlesResetLifespan.glsl"; // 重置粒子生命周期
import particlesStepLifespanShaderSource from "./shaders/particlesStepLifespan.glsl"; // 更新粒子生命周期
import particlesVertexShaderSource from "./shaders/particlesVertexShader.glsl"; // 粒子顶点着色器
import pressureIterationShaderSource from "./shaders/pressureIterationShader.glsl"; // 压力迭代（Jacobi 方法求解压力）
import projectionShaderSource from "./shaders/projectionShader.glsl";         // 压力投影（使速度场无散）
import rowShaderSource from "./shaders/rowShader.glsl";                        // 行着色器（在底部添加燃料）
import splatShaderSource from "./shaders/splatShader.glsl";                    // 溅射着色器（添加局部扰动）
import vorticityConfinementShaderSource from "./shaders/vorticityConfinementShader.glsl"; // 涡度限制（增强涡流效果）

// ============================================================================
// Canvas 初始化
// ============================================================================
// 获取页面中的 canvas 元素并设置其尺寸
const canvas = document.getElementsByTagName('canvas')[0];
canvas.width = canvas.clientWidth;   // 设置 canvas 宽度为客户端宽度
canvas.height = canvas.clientHeight; // 设置 canvas 高度为客户端高度

// ============================================================================
// 配置参数
// ============================================================================
/**
 * 模拟参数配置对象
 * 这些参数控制流体模拟的物理行为和视觉效果
 */
let config = {
  BUOYANCY: 0.2,              // 浮力系数：控制热空气上升的强度（值越大，上升越快）
  BURN_TEMPERATURE: 1700,     // 燃烧温度阈值：燃料在此温度下开始燃烧
  CONFINEMENT: 15,            // 涡度限制强度：增强涡流效果，使火焰更动态
  COOLING: 3000,              // 冷却系数：控制温度下降的速度
  DISPLAY_MODE: 0,            // 显示模式索引：0=正常，1-6=各种调试模式
  DYE_RESOLUTION: 512,        // 密度（颜色）场分辨率：控制颜色细节（越高越清晰）
  FUEL_DISSIPATION: 0.92,     // 燃料耗散率：每帧燃料的衰减（0.92 表示保留 92%）
  DENSITY_DISSIPATION: 0.99,  // 密度耗散率：每帧密度的衰减（0.99 表示保留 99%）
  NOISE_BLENDING: 0.5,        // 噪声混合系数：噪声对模拟的影响程度
  NOISE_VOLATILITY: 0.1,      // 噪声波动性：每帧添加的噪声量
  PRESSURE_DISSIPATION: 0.8, // 压力耗散率：模拟开放边界条件
  PRESSURE_ITERATIONS: 20,    // 压力求解迭代次数：越多越准确但越慢
  SIM_RESOLUTION: 256,        // 模拟分辨率：速度、温度等场的分辨率（影响性能）
  SPLAT_RADIUS: 0.7,          // 溅射半径：用户交互时添加扰动的范围（百分比）
  VELOCITY_DISSIPATION: 0.98, // 速度耗散率：每帧速度的衰减（模拟粘性）
};

/**
 * 显示模式列表
 * 用于切换不同的可视化模式，便于调试和观察不同的物理量
 */
let DISPLAY_MODES = ["Normal", "DebugFire", "DebugTemperature", "DebugFuel", "DebugPressure", "DebugDensity", "DebugNoise"];

/**
 * 纹理 ID 计数器
 * 用于为每个纹理分配唯一的纹理单元 ID（WebGL 纹理绑定需要）
 */
let LAST_TEX_ID = 0;

// ============================================================================
// FireSource 类 - 火焰粒子发射器
// ============================================================================
/**
 * 火焰粒子发射器类
 * 
 * 管理一组粒子，这些粒子代表火焰中的火花或燃料颗粒。
 * 粒子在速度场中移动，并在死亡时重置到初始位置。
 * 
 * @param {number} x - 发射器 X 坐标（像素）
 * @param {number} y - 发射器 Y 坐标（像素）
 * @param {number} dx - 初始 X 方向速度
 * @param {number} dy - 初始 Y 方向速度
 * @param {number} numParticles - 粒子数量
 * @param {number} lifespan - 粒子生命周期（秒），负数表示无限生命周期
 */
class FireSource {
  constructor (x, y, dx, dy, numParticles, lifespan) {
    // 发射器位置和初始速度
    this.x = x;              // 发射器 X 坐标
    this.y = y;              // 发射器 Y 坐标
    this.dx = dx;            // 初始 X 方向速度分量
    this.dy = dy;            // 初始 Y 方向速度分量
    
    // 粒子系统参数
    this.lifespan = lifespan; // 粒子生命周期（秒）
    // 计算存储粒子的纹理宽度（使用方形纹理，宽度 = ceil(sqrt(粒子数))）
    this.dataWidth = Math.ceil(Math.sqrt(numParticles));
    this.numParticles = numParticles; // 粒子总数
    // 如果生命周期为负数，则粒子永不死亡
    this.infiniteLifespan = !!(lifespan < 0.0);
s
    // 获取纹理格式配置
    const rgba = ext.formatRGBA;  // RGBA 格式（用于存储位置和速度）
    const r = ext.formatR;        // 单通道格式（用于存储生命周期）
    const texType = ext.halfFloatTexType; // 半精度浮点纹理类型
    
    // 创建双缓冲帧缓冲对象（Double FBO）用于粒子数据
    // 双缓冲允许读写分离，避免数据竞争
    // 粒子数据纹理：每个像素存储一个粒子的位置(x,y)和速度(dx,dy)
    this.particleData = createDoubleFBO(
      this.dataWidth,
      this.dataWidth,
      rgba.internalFormat,
      rgba.format,
      texType,
      gl.NEAREST, // 使用最近邻过滤（粒子数据需要精确值）
    );
    
    // 创建粒子生命周期纹理：每个像素存储对应粒子的剩余生命周期
    this.particleLifespans = createDoubleFBO(
      this.dataWidth,
      this.dataWidth,
      r.internalFormat,
      r.format,
      texType,
      gl.NEAREST,
    );
    
    // 创建 UV 坐标缓冲区
    // 用于将纹理坐标映射到粒子索引，每个粒子对应纹理中的一个像素
    this.particleUVs = gl.createBuffer();
    var arrayUVs = [];
    // 生成每个粒子的 UV 坐标（范围 [0,1]）
    for (let i = 0; i < this.dataWidth; i++) {
      for (let j = 0; j < this.dataWidth; j++) {
        arrayUVs.push(i / this.dataWidth); // U 坐标
        arrayUVs.push(j / this.dataWidth); // V 坐标
      }
    }
    // 将 UV 坐标上传到 GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleUVs);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrayUVs), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // 初始化粒子：重置所有粒子的位置和速度到发射器位置
    // 使用 GPU 着色器批量处理所有粒子
    particlesResetDataProgram.bind();
    // 设置初始位置（归一化坐标，范围 [0,1]）
    gl.uniform2f(particlesResetDataProgram.uniforms.initialPosition, this.x / canvas.width, this.y / canvas.height);
    // 设置初始速度
    gl.uniform2f(particlesResetDataProgram.uniforms.initialVelocity, this.dx, this.dy);
    // 绑定输入纹理
    gl.uniform1i(particlesResetDataProgram.uniforms.particleData, this.particleData.read.texId);
    gl.uniform1i(particlesResetDataProgram.uniforms.particleLifespans, this.particleLifespans.read.texId);
    // 执行着色器，将结果写入写缓冲区
    blit(this.particleData.write.fbo);
    // 交换读写缓冲区
    this.particleData.swap();
    
    // 初始化粒子生命周期：将所有粒子的生命周期设置为初始值
    particlesResetLifespanProgram.bind();
    gl.uniform1f(particlesResetLifespanProgram.uniforms.initialLifespan, this.lifespan);
    gl.uniform1i(particlesResetLifespanProgram.uniforms.particleData, this.particleData.read.texId);
    gl.uniform1i(particlesResetLifespanProgram.uniforms.particleLifespans, this.particleLifespans.read.texId);
    blit(this.particleLifespans.write.fbo);
    this.particleLifespans.swap();
  }

  /**
   * 更新粒子系统
   * 每帧调用，更新粒子的位置、生命周期，并重置死亡的粒子
   * 
   * @param {number} dt - 时间步长（秒），通常为 1/60 秒
   */
  step (dt) {
    // 设置视口为粒子数据纹理的尺寸
    gl.viewport(0, 0, this.dataWidth, this.dataWidth);

    // 步骤 1：平流粒子（让粒子随速度场移动）
    // 平流是流体模拟的核心：物质随速度场移动
    particlesAdvectionProgram.bind();
    gl.uniform1f(particlesAdvectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION); // 速度耗散
    gl.uniform1f(particlesAdvectionProgram.uniforms.dt, dt); // 时间步长
    gl.uniform1i(particlesAdvectionProgram.uniforms.particleData, this.particleData.read.texId); // 当前粒子数据
    gl.uniform2f(particlesAdvectionProgram.uniforms.texelSize, 1 / simWidth, 1 / simHeight); // 纹理像素大小
    gl.uniform1i(particlesAdvectionProgram.uniforms.uVelocity, velocity.read.texId); // 速度场
    blit(this.particleData.write.fbo); // 执行着色器
    this.particleData.swap(); // 交换缓冲区

    // 如果粒子有生命周期限制，需要更新生命周期并重置死亡的粒子
    if (!this.infiniteLifespan) {
      // 步骤 2：更新粒子生命周期（减少剩余时间）
      particlesStepLifespanProgram.bind();
      gl.uniform1i(particlesStepLifespanProgram.uniforms.particleData, this.particleData.read.texId);
      gl.uniform1i(particlesStepLifespanProgram.uniforms.particleLifespans, this.particleLifespans.read.texId);
      gl.uniform1f(particlesStepLifespanProgram.uniforms.dt, dt);
      blit(this.particleLifespans.write.fbo);
      this.particleLifespans.swap();

      // 步骤 3：重置死亡的粒子（生命周期 <= 0 的粒子）
      // 将死亡粒子的位置和速度重置为发射器的初始值
      particlesResetDataProgram.bind();
      gl.uniform2f(particlesResetDataProgram.uniforms.initialPosition, this.x / canvas.width, this.y / canvas.height);
      gl.uniform2f(particlesResetDataProgram.uniforms.initialVelocity, this.dx, this.dy);
      gl.uniform1i(particlesResetDataProgram.uniforms.particleData, this.particleData.read.texId);
      gl.uniform1i(particlesResetDataProgram.uniforms.particleLifespans, this.particleLifespans.read.texId);
      blit(this.particleData.write.fbo);
      this.particleData.swap();
      
      // 步骤 4：重置死亡粒子的生命周期
      particlesResetLifespanProgram.bind();
      gl.uniform1f(particlesResetLifespanProgram.uniforms.initialLifespan, this.lifespan);
      gl.uniform1i(particlesResetLifespanProgram.uniforms.particleData, this.particleData.read.texId);
      gl.uniform1i(particlesResetLifespanProgram.uniforms.particleLifespans, this.particleLifespans.read.texId);
      blit(this.particleLifespans.write.fbo);
      this.particleLifespans.swap();
    }
  }

  /**
   * 渲染粒子到指定的帧缓冲
   * 
   * @param {number} viewportWidth - 视口宽度
   * @param {number} viewportHeight - 视口高度
   * @param {WebGLFramebuffer} destination - 目标帧缓冲（null 表示渲染到屏幕）
   * @param {Object} color - 粒子颜色 {r, g, b}
   */
  renderParticles (viewportWidth, viewportHeight, destination, color) {
    // 设置渲染视口
    gl.viewport(0, 0, viewportWidth, viewportHeight);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleUVs);

    // 绑定粒子渲染着色器
    particlesRenderProgram.bind();
    // 设置着色器参数
    gl.uniform1i(particlesRenderProgram.uniforms.particleData, this.particleData.read.texId); // 粒子数据纹理
    gl.uniform1f(particlesRenderProgram.uniforms.size, 1.0); // 粒子大小
    gl.uniform3f(particlesRenderProgram.uniforms.color, color.r, color.g, color.b); // 粒子颜色

    // 设置顶点属性（UV 坐标）
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleUVs);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    
    // 绑定目标帧缓冲并绘制粒子（使用点图元）
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
    gl.drawArrays(gl.POINTS, 0, this.numParticles);
  }
}

// ============================================================================
// WebGL 上下文初始化
// ============================================================================
/**
 * 获取并配置 WebGL 渲染上下文
 * 
 * 尝试获取 WebGL2 上下文，如果不支持则回退到 WebGL1。
 * 同时检测并启用必要的扩展（如半精度浮点纹理）。
 * 
 * @param {HTMLCanvasElement} canvas - Canvas 元素
 * @returns {Object} 包含 gl 上下文和扩展信息的对象
 */
function getWebGLContext (canvas) {
  // WebGL 上下文创建参数
  // 禁用不需要的功能以提高性能
  const params = {
    alpha: false,      // 不需要 alpha 通道（不透明背景）
    depth: false,      // 不需要深度缓冲（2D 模拟）
    stencil: false,    // 不需要模板缓冲
    antialias: false,  // 禁用抗锯齿（提高性能）
  };

  // 尝试获取 WebGL2 上下文（更好的性能和功能）
  let gl = canvas.getContext('webgl2', params);
  const isWebGL2 = !!gl;
  // 如果不支持 WebGL2，回退到 WebGL1
  if (!isWebGL2) {
    gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
  }

  // 检测并启用必要的扩展
  let halfFloat;
  let supportLinearFiltering; // 是否支持浮点纹理的线性过滤
  
  if (isWebGL2) {
    // WebGL2 原生支持浮点纹理
    gl.getExtension('EXT_color_buffer_float'); // 启用浮点颜色缓冲
    supportLinearFiltering = gl.getExtension('OES_texture_float_linear'); // 检查线性过滤支持
  } else {
    // WebGL1 需要扩展来支持半精度浮点
    halfFloat = gl.getExtension('OES_texture_half_float');
    supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
  }

  // 设置清除颜色为黑色
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // 确定半精度浮点纹理类型
  const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
  
  // 纹理格式变量（将在下面确定）
  let formatRGBA; // RGBA 格式（用于速度、密度等）
  let formatRG;   // RG 格式（用于速度场）
  let formatR;    // 单通道格式（用于温度、压力等）

  // 根据 WebGL 版本确定最佳纹理格式
  // 尝试使用最紧凑的格式，如果不支持则回退到更通用的格式
  if (isWebGL2) {
    // WebGL2 支持更精确的格式
    formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType); // 16位半精度 RGBA
    formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);       // 16位半精度 RG
    formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);        // 16位半精度单通道
  } else {
    // WebGL1 通常只支持 RGBA 格式
    formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType); // 回退到 RGBA
    formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);  // 回退到 RGBA
  }

  // 检查是否成功获取支持的格式
  if (formatRGBA == null) {
    console.log(isWebGL2 ? 'webgl2' : 'webgl', 'not supported');
  } else {
    console.log(isWebGL2 ? 'webgl2' : 'webgl', 'supported');
  }

  // 返回 WebGL 上下文和扩展信息
  return {
    gl, // WebGL 上下文
    ext: {
      formatRGBA,              // RGBA 纹理格式
      formatRG,                // RG 纹理格式
      formatR,                 // 单通道纹理格式
      halfFloatTexType,        // 半精度浮点纹理类型
      supportLinearFiltering,  // 是否支持线性过滤
    },
  };
}

/**
 * 获取支持的纹理格式
 * 
 * 尝试使用指定的格式，如果不支持则回退到更通用的格式。
 * 例如：R16F -> RG16F -> RGBA16F
 * 
 * @param {WebGLRenderingContext} gl - WebGL 上下文
 * @param {number} internalFormat - 内部格式（如 gl.RGBA16F）
 * @param {number} format - 像素格式（如 gl.RGBA）
 * @param {number} type - 数据类型（如 gl.HALF_FLOAT）
 * @returns {Object|null} 支持的格式对象或 null
 */
function getSupportedFormat (gl, internalFormat, format, type) {
  // 检查格式是否支持
  if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
    // 如果不支持，尝试回退到更通用的格式
    switch (internalFormat) {
      case gl.R16F:
        // 单通道不支持，尝试双通道
        return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
      case gl.RG16F:
        // 双通道不支持，尝试四通道
        return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
      default:
        // 所有格式都不支持
        return null;
    }
  }

  // 格式支持，返回格式信息
  return {
    internalFormat, // 内部格式
    format,         // 像素格式
  };
}

/**
 * 检查是否支持指定的渲染纹理格式
 * 
 * 通过实际创建纹理和帧缓冲来测试格式支持。
 * 这是检测格式支持的最可靠方法。
 * 
 * @param {WebGLRenderingContext} gl - WebGL 上下文
 * @param {number} internalFormat - 内部格式
 * @param {number} format - 像素格式
 * @param {number} type - 数据类型
 * @returns {boolean} 是否支持该格式
 */
function supportRenderTextureFormat (gl, internalFormat, format, type) {
  // 创建测试纹理
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // 设置纹理参数
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // 尝试创建纹理（4x4 测试尺寸）
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

  // 创建帧缓冲并附加纹理
  let fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  // 检查帧缓冲状态
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status != gl.FRAMEBUFFER_COMPLETE) {
    // 格式不支持
    return false;
  }
  // 格式支持
  return true;
}

// ============================================================================
// 全局变量初始化
// ============================================================================
// 获取 WebGL 上下文和扩展信息
const { gl, ext } = getWebGLContext(canvas);

// ============================================================================
// 着色器编译
// ============================================================================
/**
 * 编译 GLSL 着色器
 * 
 * 将 GLSL 源代码编译为 WebGL 着色器对象。
 * 如果编译失败，抛出包含错误信息的异常。
 * 
 * @param {number} type - 着色器类型（gl.VERTEX_SHADER 或 gl.FRAGMENT_SHADER）
 * @param {string} source - GLSL 源代码字符串
 * @returns {WebGLShader} 编译后的着色器对象
 * @throws {string} 如果编译失败，抛出错误信息
 */
function compileShader (type, source) {
  // 创建着色器对象
  const shader = gl.createShader(type);
  // 设置着色器源代码
  gl.shaderSource(shader, source);
  // 编译着色器
  gl.compileShader(shader);

  // 检查编译状态
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // 编译失败，抛出错误信息
    throw gl.getShaderInfoLog(shader);
  }

  return shader;
}

// 编译所有着色器并存储在对象中
// 这些着色器将在后续创建 GLProgram 时使用
const shaders = {
  addNoiseShader: compileShader(gl.FRAGMENT_SHADER, addNoiseShaderSource),
  advectionManualFilteringShader: compileShader(gl.FRAGMENT_SHADER, advectionManualFilteringShaderSource),
  advectionShader: compileShader(gl.FRAGMENT_SHADER, advectionShaderSource),
  baseVertexShader: compileShader(gl.VERTEX_SHADER, baseVertexShaderSource),
  buoyancyShader: compileShader(gl.FRAGMENT_SHADER, buoyancyShaderSource),
  clearShader: compileShader(gl.FRAGMENT_SHADER, clearShaderSource),
  combustionShader: compileShader(gl.FRAGMENT_SHADER, combustionShaderSource),
  curlShader: compileShader(gl.FRAGMENT_SHADER, curlShaderSource),
  debugFireShader: compileShader(gl.FRAGMENT_SHADER, debugFireShaderSource),
  debugFloatShader: compileShader(gl.FRAGMENT_SHADER, debugFloatShaderSource),
  displayShader: compileShader(gl.FRAGMENT_SHADER, displayShaderSource),
  displayFireShader: compileShader(gl.FRAGMENT_SHADER, displayFireShaderSource),
  divergenceShader: compileShader(gl.FRAGMENT_SHADER, divergenceShaderSource),
  particlesAdvectionShader: compileShader(gl.FRAGMENT_SHADER, particlesAdvectionShaderSource),
  particlesRenderShader: compileShader(gl.FRAGMENT_SHADER, particlesRenderShaderSource),
  particlesResetDataShader: compileShader(gl.FRAGMENT_SHADER, particlesResetDataShaderSource),
  particlesResetLifespanShader: compileShader(gl.FRAGMENT_SHADER, particlesResetLifespanShaderSource),
  particlesStepLifespanShader: compileShader(gl.FRAGMENT_SHADER, particlesStepLifespanShaderSource),
  particlesVertexShader: compileShader(gl.VERTEX_SHADER, particlesVertexShaderSource),
  pressureIterationShader: compileShader(gl.FRAGMENT_SHADER, pressureIterationShaderSource),
  projectionShader: compileShader(gl.FRAGMENT_SHADER, projectionShaderSource),
  rowShader: compileShader(gl.FRAGMENT_SHADER, rowShaderSource),
  splatShader: compileShader(gl.FRAGMENT_SHADER, splatShaderSource),
  vorticityConfinementShader: compileShader(gl.FRAGMENT_SHADER, vorticityConfinementShaderSource),
};

// ============================================================================
// GLProgram 类 - WebGL 程序封装
// ============================================================================
/**
 * WebGL 着色器程序封装类
 * 
 * 封装了顶点着色器和片段着色器组成的完整 WebGL 程序。
 * 自动提取所有 uniform 变量的位置，便于后续设置参数。
 */
class GLProgram {
  /**
   * 创建并链接 WebGL 程序
   * 
   * @param {WebGLShader} vertexShader - 顶点着色器
   * @param {WebGLShader} fragmentShader - 片段着色器
   */
  constructor (vertexShader, fragmentShader) {
    // Uniform 变量位置字典，键为变量名，值为位置对象
    this.uniforms = {};
    // 创建 WebGL 程序对象
    this.program = gl.createProgram();

    // 附加着色器到程序
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    // 链接程序
    gl.linkProgram(this.program);

    // 检查链接状态
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      // 链接失败，抛出错误信息
      throw gl.getProgramInfoLog(this.program);
    }

    // 提取所有 uniform 变量的位置
    // 这样可以在后续通过 this.uniforms['变量名'] 访问
    const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const uniformName = gl.getActiveUniform(this.program, i).name;
      this.uniforms[uniformName] = gl.getUniformLocation(this.program, uniformName);
    }
  }

  /**
   * 绑定此程序为当前使用的程序
   * 在设置 uniform 和绘制之前必须调用
   */
  bind () {
    gl.useProgram(this.program);
  }
}

// ============================================================================
// 全屏四边形渲染函数（Blit）
// ============================================================================
/**
 * 创建全屏四边形渲染函数
 * 
 * 使用立即执行函数表达式（IIFE）创建闭包，缓存顶点和索引缓冲区。
 * 这个函数用于将片段着色器的结果渲染到指定的帧缓冲。
 * 
 * 全屏四边形覆盖整个视口，每个像素都会执行片段着色器。
 * 这是 GPU 计算的标准模式：使用片段着色器进行并行计算。
 * 
 * @param {WebGLFramebuffer|null} destination - 目标帧缓冲，null 表示渲染到屏幕
 */
const blit = (() => {
  // 创建全屏四边形的顶点缓冲区
  // 顶点坐标（归一化设备坐标，范围 [-1, 1]）
  // 顺序：左下(-1,-1), 左上(-1,1), 右上(1,1), 右下(1,-1)
  const quadVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  
  // 创建索引缓冲区（定义两个三角形组成四边形）
  // 索引：0-1-2（第一个三角形），0-2-3（第二个三角形）
  const quadElementBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadElementBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

  // 返回渲染函数
  return (destination) => {
    // 绑定顶点缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexBuffer);
    // 设置顶点属性（位置，2个浮点数）
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    // 绑定目标帧缓冲
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
    // 绘制两个三角形（6个顶点）
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };
})();

// ============================================================================
// 帧缓冲初始化
// ============================================================================
/**
 * 初始化所有模拟所需的帧缓冲对象（FBO）
 * 
 * 创建用于存储各种物理量的纹理和帧缓冲：
 * - 速度场（velocity）：RG 格式，存储速度的 x 和 y 分量
 * - 密度场（density）：RGBA 格式，存储颜色信息
 * - 温度场（temperature）：单通道，存储温度值
 * - 燃料场（fuel）：单通道，存储燃料量
 * - 压力场（pressure）：单通道，用于压力投影求解
 * - 散度场（divergence）：单通道，速度场的散度
 * - 旋度场（curl）：单通道，速度场的旋度
 * - 噪声场（noise）：单通道，用于添加湍流效果
 */
function initFramebuffers() {
  // 计算模拟分辨率和密度分辨率（考虑宽高比）
  let simRes = getResolution(config.SIM_RESOLUTION);
  let dyeRes = getResolution(config.DYE_RESOLUTION);

  // 设置全局分辨率变量
  simWidth = simRes.width;   // 模拟场宽度（速度、温度、压力等）
  simHeight = simRes.height; // 模拟场高度
  dyeWidth = dyeRes.width;   // 密度场宽度（通常更高，用于更清晰的颜色）
  dyeHeight = dyeRes.height; // 密度场高度

  // 获取纹理格式配置
  const texType = ext.halfFloatTexType; // 半精度浮点纹理类型
  const rgba = ext.formatRGBA;          // RGBA 格式
  const rg = ext.formatRG;              // RG 格式（双通道）
  const r = ext.formatR;                // 单通道格式

  // 创建旋度场（单缓冲，因为只在计算时临时使用）
  // 旋度用于涡度限制，增强涡流效果
  curl = createFBO(
    simWidth,
    simHeight,
    r.internalFormat,
    r.format,
    texType,
    gl.NEAREST, // 使用最近邻过滤（计算需要精确值）
  );
  
  // 创建密度场（双缓冲，用于颜色/烟雾效果）
  // 密度场通常使用更高分辨率以获得更清晰的视觉效果
  density = createDoubleFBO(
    dyeWidth,
    dyeHeight,
    rgba.internalFormat,
    rgba.format,
    texType,
    ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST, // 线性过滤使颜色更平滑
  );
  
  // 创建散度场（单缓冲，临时计算用）
  // 散度用于压力投影，使速度场无散（满足不可压缩条件）
  divergence = createFBO(
    simWidth,
    simHeight,
    r.internalFormat,
    r.format,
    texType,
    gl.NEAREST,
  );
  
  // 创建燃料场（双缓冲）
  // 燃料在燃烧时转化为温度
  fuel = createDoubleFBO(
    simWidth,
    simHeight,
    r.internalFormat,
    r.format,
    texType,
    ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST,
  );
  
  // 创建噪声场（双缓冲）
  // 用于添加湍流和随机性，使火焰更自然
  noise = createDoubleFBO(
    simWidth,
    simHeight,
    r.internalFormat,
    r.format,
    texType,
    ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST,
  );
  
  // 创建压力场（双缓冲）
  // 用于压力投影求解，使速度场满足不可压缩条件
  pressure = createDoubleFBO(
    simWidth,
    simHeight,
    r.internalFormat,
    r.format,
    texType,
    gl.NEAREST, // 压力求解需要精确值
  );
  
  // 创建温度场（双缓冲）
  // 温度影响浮力，热空气上升
  temperature = createDoubleFBO(
    simWidth,
    simHeight,
    r.internalFormat,
    r.format,
    texType,
    ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST,
  );
  
  // 创建速度场（双缓冲）
  // 速度场是流体模拟的核心，存储每个点的速度向量 (vx, vy)
  velocity = createDoubleFBO(
    simWidth,
    simHeight,
    rg.internalFormat, // RG 格式：R 通道存储 vx，G 通道存储 vy
    rg.format,
    texType,
    ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST, // 线性过滤使速度场更平滑
  );
}

/**
 * 根据基础分辨率和画布宽高比计算实际分辨率
 * 
 * 确保模拟场保持正确的宽高比，避免拉伸变形。
 * 分辨率会根据画布方向（横向或纵向）自动调整。
 * 
 * @param {number} resolution - 基础分辨率（较短边的像素数）
 * @returns {Object} 包含 width 和 height 的对象
 */
function getResolution (resolution) {
  // 计算宽高比（始终 >= 1）
  let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  if (aspectRatio < 1) {
    aspectRatio = 1.0 / aspectRatio;
  }

  // 计算较长边和较短边的分辨率
  let max = resolution * aspectRatio; // 较长边的分辨率
  let min = resolution;                // 较短边的分辨率

  // 根据画布方向返回相应的分辨率
  if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
    // 横向画布：宽度 > 高度
    return { width: max, height: min };
  } else {
    // 纵向画布：高度 >= 宽度
    return { width: min, height: max };
  }
}

/**
 * 创建单缓冲帧缓冲对象（FBO）
 * 
 * 创建一个纹理和对应的帧缓冲，用于渲染到纹理。
 * 单缓冲适用于临时计算或不需要双缓冲的场景。
 * 
 * @param {number} w - 纹理宽度
 * @param {number} h - 纹理高度
 * @param {number} internalFormat - 内部格式（如 gl.RGBA16F）
 * @param {number} format - 像素格式（如 gl.RGBA）
 * @param {number} type - 数据类型（如 gl.HALF_FLOAT）
 * @param {number} filter - 过滤模式（gl.NEAREST 或 gl.LINEAR）
 * @returns {Object} 包含 texture、fbo 和 texId 的对象
 */
function createFBO (w, h, internalFormat, format, type, filter) {
  // 分配唯一的纹理单元 ID
  const texId = LAST_TEX_ID++;
  gl.activeTexture(gl.TEXTURE0 + texId);
  
  // 创建纹理对象
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  
  // 设置纹理参数
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); // 缩小过滤
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter); // 放大过滤
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // S 方向边缘处理
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // T 方向边缘处理
  
  // 分配纹理存储空间（不初始化数据，使用 null）
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

  // 创建帧缓冲并附加纹理
  let fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  
  // 设置视口并清除为黑色
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // 返回纹理、帧缓冲和纹理 ID
  return {
    texture, // WebGL 纹理对象
    fbo,     // WebGL 帧缓冲对象
    texId,   // 纹理单元 ID（用于绑定）
  };
}

/**
 * 创建双缓冲帧缓冲对象（Double FBO）
 * 
 * 双缓冲是 GPU 计算的标准模式：
 * - 从"读"缓冲区读取数据
 * - 将计算结果写入"写"缓冲区
 * - 交换缓冲区，使写缓冲区变为读缓冲区
 * 
 * 这样可以避免读写冲突，因为 GPU 不允许同时读写同一纹理。
 * 
 * @param {number} w - 纹理宽度
 * @param {number} h - 纹理高度
 * @param {number} internalFormat - 内部格式
 * @param {number} format - 像素格式
 * @param {number} type - 数据类型
 * @param {number} filter - 过滤模式
 * @returns {Object} 包含 read、write 和 swap 方法的对象
 */
function createDoubleFBO (w, h, internalFormat, format, type, filter) {
  // 创建两个独立的 FBO
  let fbo1 = createFBO(w, h, internalFormat, format, type, filter);
  let fbo2 = createFBO(w, h, internalFormat, format, type, filter);

  // 返回双缓冲对象
  return {
    /**
     * 获取读缓冲区（当前帧的数据）
     * 使用 getter 以便在交换后自动返回正确的缓冲区
     */
    get read () {
      return fbo1;
    },
    /**
     * 获取写缓冲区（用于写入新数据）
     * 使用 getter 以便在交换后自动返回正确的缓冲区
     */
    get write () {
      return fbo2;
    },
    /**
     * 交换读写缓冲区
     * 在每帧计算完成后调用，使新计算的数据变为读缓冲区
     */
    swap () {
      let temp = fbo1;
      fbo1 = fbo2;
      fbo2 = temp;
    },
  };
}

// ============================================================================
// 主循环
// ============================================================================
/**
 * 主更新循环
 * 
 * 每帧执行以下步骤：
 * 1. 检查并调整画布大小
 * 2. 处理用户输入（鼠标/触摸）
 * 3. 执行物理模拟步骤
 * 4. 渲染结果到屏幕
 * 5. 请求下一帧
 */
function update () {
  resizeCanvas();        // 调整画布大小（如果需要）
  input();              // 处理用户输入
  step(0.016);          // 执行物理模拟（假设 60 FPS，dt = 1/60 ≈ 0.016）
  render();             // 渲染到屏幕
  requestAnimationFrame(update); // 请求下一帧
}

/**
 * 处理用户输入
 * 
 * 1. 在底部添加燃料（持续的火源）
 * 2. 处理鼠标/触摸输入，添加速度和颜色扰动
 */
function input () {
  // 在底部添加燃料（创建持续的火源）
  // 这模拟了燃料从底部持续供应的效果
  gl.viewport(0, 0, simWidth, simHeight);
  rowProgram.bind();
  gl.uniform2f(rowProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight); // 纹理像素大小
  gl.uniform1f(rowProgram.uniforms.y, 10.0); // 底部行位置（像素）
  gl.uniform1i(rowProgram.uniforms.uTarget, fuel.read.texId); // 目标纹理（燃料场）
  gl.uniform1f(rowProgram.uniforms.useMax, true); // 使用最大值混合（确保燃料持续存在）
  blit(fuel.write.fbo); // 执行着色器
  fuel.swap(); // 交换缓冲区

  // 处理所有指针（鼠标/触摸）的输入
  for (let i = 0; i < pointers.length; i++) {
    const pointer = pointers[i];
    if (pointer.moved) {
      // 如果指针移动了，添加扰动（速度、燃料和颜色）
      splat(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color);
      pointer.moved = false; // 重置移动标志
    }
  }
}

/**
 * 调整画布大小
 * 
 * 当画布尺寸改变时（例如窗口大小改变），重新初始化所有帧缓冲。
 * 这确保模拟场始终匹配画布尺寸。
 */
function resizeCanvas () {
  // 检查画布尺寸是否改变
  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    // 更新画布尺寸
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    // 重新初始化所有帧缓冲（使用新的分辨率）
    initFramebuffers();
  }
}

/**
 * 渲染函数
 * 
 * 根据当前的显示模式，将相应的物理量渲染到屏幕。
 * 支持多种调试模式，便于观察不同的物理量。
 */
function render () {
  // 获取绘制缓冲区尺寸
  let width = gl.drawingBufferWidth;
  let height = gl.drawingBufferHeight;

  // 设置视口为整个画布
  gl.viewport(0, 0, width, height);

  // 根据显示模式选择相应的渲染方式
  switch(DISPLAY_MODES[config.DISPLAY_MODE]) {
    case "Normal": {
      // 正常模式：渲染完整的火焰效果
      // 结合密度、温度和燃料信息，生成最终的火焰视觉效果
      displayFireProgram.bind();
      gl.uniform1i(displayFireProgram.uniforms.uDensity, density.read.texId);      // 密度场（颜色/烟雾）
      gl.uniform1i(displayFireProgram.uniforms.uTemperature, temperature.read.texId); // 温度场（火焰亮度）
      gl.uniform1i(displayFireProgram.uniforms.uFuel, fuel.read.texId);           // 燃料场
      gl.uniform1f(displayFireProgram.uniforms.burnTemperature, config.BURN_TEMPERATURE); // 燃烧温度阈值
      blit(null); // 渲染到屏幕（null 表示默认帧缓冲）

      // 渲染所有火焰发射器的粒子（火花效果）
      fireSources.forEach(fireSource => {
        fireSource.renderParticles(width, height, null, { r: 1.0, g: 1.0, b: 1.0 }); // 白色粒子
      });
      break;
    }
    case "DebugFire": {
      // 调试模式：同时显示燃料和温度
      debugFireProgram.bind();
      gl.uniform1i(debugFireProgram.uniforms.uFuel, fuel.read.texId);
      gl.uniform1i(debugFireProgram.uniforms.uTemperature, temperature.read.texId);
      gl.uniform1f(debugFireProgram.uniforms.temperatureScalar, 0.001); // 温度缩放（温度值很大，需要缩小显示）
      gl.uniform1f(debugFireProgram.uniforms.fuelScalar, 1.0); // 燃料缩放
      blit(null);
      break;
    }
    case "DebugTemperature": {
      // 调试模式：仅显示温度场
      debugFloatProgram.bind();
      gl.uniform1i(debugFloatProgram.uniforms.uTexture, temperature.read.texId);
      gl.uniform1f(debugFloatProgram.uniforms.scalar, 0.001); // 温度值很大，需要缩放
      blit(null);
      break;
    }
    case "DebugFuel": {
      // 调试模式：仅显示燃料场
      debugFloatProgram.bind();
      gl.uniform1i(debugFloatProgram.uniforms.uTexture, fuel.read.texId);
      gl.uniform1f(debugFloatProgram.uniforms.scalar, 1.0);
      blit(null);
      break;
    }
    case "DebugPressure": {
      // 调试模式：仅显示压力场
      debugFloatProgram.bind();
      gl.uniform1i(debugFloatProgram.uniforms.uTexture, pressure.read.texId);
      gl.uniform1f(debugFloatProgram.uniforms.scalar, 1.0);
      blit(null);
      break;
    }
    case "DebugNoise": {
      // 调试模式：仅显示噪声场
      debugFloatProgram.bind();
      gl.uniform1i(debugFloatProgram.uniforms.uTexture, noise.read.texId);
      gl.uniform1f(debugFloatProgram.uniforms.scalar, 1.0);
      blit(null);
      break;
    }
    default: /* DebugDensity */ {
      // 调试模式：仅显示密度场（颜色/烟雾）
      displayProgram.bind();
      gl.uniform1i(displayProgram.uniforms.uTexture, density.read.texId);
      blit(null);
      break;
    }
  }

  // 更新调试信息显示
  document.getElementById("debug-box").innerHTML = DISPLAY_MODES[config.DISPLAY_MODE];
}

/**
 * 添加局部扰动（Splat）
 * 
 * 在指定位置添加速度和颜色扰动，用于用户交互。
 * 在速度场、燃料场和密度场中添加局部影响。
 * 
 * @param {number} x - 屏幕 X 坐标（像素）
 * @param {number} y - 屏幕 Y 坐标（像素）
 * @param {number} dx - X 方向速度分量
 * @param {number} dy - Y 方向速度分量
 * @param {Object} color - 颜色对象 {r, g, b}
 */
function splat (x, y, dx, dy, color) {
  // 设置视口为模拟分辨率
  gl.viewport(0, 0, simWidth, simHeight);
  splatProgram.bind();
  
  // 步骤 1：在速度场中添加速度扰动
  gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.texId);
  gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height); // 宽高比
  // 将屏幕坐标转换为归一化坐标 [0,1]，注意 Y 坐标需要翻转（屏幕 Y 向下，纹理 Y 向上）
  gl.uniform2f(splatProgram.uniforms.point, x / canvas.width, 1.0 - y / canvas.height);
  gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 1.0); // 速度向量（注意 dy 取反）
  gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS / 100.0); // 扰动半径
  gl.uniform1f(splatProgram.uniforms.useMax, false); // 使用加法混合
  blit(velocity.write.fbo);
  velocity.swap();

  // 步骤 2：在燃料场中添加燃料（红色，表示燃料）
  gl.uniform1i(splatProgram.uniforms.uTarget, fuel.read.texId);
  gl.uniform3f(splatProgram.uniforms.color, 1.0, 0.0, 0.0); // 红色 = 燃料
  gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS / 100.0);
  gl.uniform1f(splatProgram.uniforms.useMax, true); // 使用最大值混合（确保燃料存在）
  blit(fuel.write.fbo);
  fuel.swap();

  // 步骤 3：在密度场中添加颜色（使用更高分辨率）
  gl.viewport(0, 0, dyeWidth, dyeHeight);
  gl.uniform1i(splatProgram.uniforms.uTarget, density.read.texId);
  gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b); // 用户指定的颜色
  gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS / 100.0);
  gl.uniform1f(splatProgram.uniforms.useMax, false); // 使用加法混合
  blit(density.write.fbo);
  density.swap();
}

// ============================================================================
// 全局变量声明
// ============================================================================
// 输入系统
let pointers = [new pointerPrototype()]; // 指针数组（鼠标/触摸）
let fireSources = [];                     // 火焰粒子发射器数组

// 分辨率变量
let simWidth;   // 模拟场宽度（速度、温度、压力等）
let simHeight;  // 模拟场高度
let dyeWidth;   // 密度场宽度（通常更高）
let dyeHeight;  // 密度场高度

// 帧缓冲对象（存储各种物理量）
let curl;        // 旋度场（单缓冲）
let density;     // 密度场（双缓冲，颜色/烟雾）
let divergence;  // 散度场（单缓冲）
let fuel;        // 燃料场（双缓冲）
let noise;       // 噪声场（双缓冲）
let pressure;    // 压力场（双缓冲）
let temperature; // 温度场（双缓冲）
let velocity;    // 速度场（双缓冲）

// WebGL 程序对象
let addNoiseProgram;              // 添加噪声程序
let advectionProgram;             // 平流程序
let buoyancyProgram;              // 浮力程序
let clearProgram;                 // 清除程序
let combustionProgram;            // 燃烧程序
let curlProgram;                  // 旋度计算程序
let debugFireProgram;             // 调试火焰程序
let debugFloatProgram;            // 调试浮点程序
let displayProgram;               // 显示程序
let displayFireProgram;           // 显示火焰程序
let divergenceProgram;            // 散度计算程序
let particlesAdvectionProgram;   // 粒子平流程序
let particlesRenderProgram;      // 粒子渲染程序
let particlesResetDataProgram;   // 粒子数据重置程序
let particlesResetLifespanProgram; // 粒子生命周期重置程序
let particlesStepLifespanProgram; // 粒子生命周期更新程序
let pressureIterationProgram;    // 压力迭代程序
let projectionProgram;           // 压力投影程序
let rowProgram;                   // 行程序（添加燃料）
let splatProgram;                 // 溅射程序
let vorticityConfinementProgram; // 涡度限制程序

// ============================================================================
// 核心模拟步骤函数
// ============================================================================
/**
 * 执行一帧的物理模拟
 * 
 * 这是流体模拟的核心函数，实现了基于 Navier-Stokes 方程的流体动力学模拟。
 * 模拟步骤按照以下顺序执行：
 * 
 * 1. 粒子燃料注入：从粒子发射器添加燃料
 * 2. 燃烧计算：燃料转化为温度，温度自然冷却
 * 3. 速度平流：速度场随自身平流（自平流）
 * 4. 涡度限制：增强涡流效果
 * 5. 浮力：热空气上升
 * 6. 压力投影：使速度场无散（满足不可压缩条件）
 * 7. 物质平流：密度、温度、燃料、噪声随速度场移动
 * 8. 噪声更新：添加新的噪声以保持湍流
 * 9. 粒子更新：更新所有粒子发射器
 * 
 * @param {number} dt - 时间步长（秒）
 */
function step (dt) {
  // 设置视口为模拟分辨率
  gl.viewport(0, 0, simWidth, simHeight);

  // ========================================================================
  // 步骤 1：从粒子发射器添加燃料
  // ========================================================================
  // 将粒子渲染到燃料场，粒子位置处的燃料值增加
  // 这模拟了粒子携带燃料的效果
  fireSources.forEach(fireSource => {
    fireSource.renderParticles(simWidth, simHeight, fuel.read.fbo, { r: 1.0, g: 0., b: 0. });
  });

  // ========================================================================
  // 步骤 2：燃烧计算
  // ========================================================================
  // 燃烧过程：
  // - 燃料在达到燃烧温度时转化为热量（增加温度）
  // - 温度按照物理规律自然冷却（与温度的四次方成正比）
  // - 这模拟了真实的燃烧和冷却过程
  combustionProgram.bind();
  gl.uniform2f(combustionProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
  gl.uniform1i(combustionProgram.uniforms.uFuel, fuel.read.texId);           // 燃料场
  gl.uniform1i(combustionProgram.uniforms.uTemperature, temperature.read.texId); // 温度场
  gl.uniform1i(combustionProgram.uniforms.uNoise, noise.read.texId);       // 噪声场（可选）
  gl.uniform1f(combustionProgram.uniforms.noiseBlending, config.NOISE_BLENDING);
  gl.uniform1f(combustionProgram.uniforms.burnTemperature, config.BURN_TEMPERATURE); // 燃烧温度阈值
  gl.uniform1f(combustionProgram.uniforms.cooling, config.COOLING);        // 冷却系数
  gl.uniform1f(combustionProgram.uniforms.dt, dt);                          // 时间步长
  blit(temperature.write.fbo);
  temperature.swap();

  // ========================================================================
  // 步骤 3：速度平流（自平流）
  // ========================================================================
  // 平流是流体模拟的核心概念：物质随速度场移动
  // 这里速度场随自身平流，模拟了流体的惯性
  // 使用半拉格朗日方法（Semi-Lagrangian）：从当前位置回溯，找到来源位置的值
  advectionProgram.bind();
  gl.uniform2f(advectionProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
  // 如果不支持线性过滤，需要手动指定纹理像素大小
  if (!ext.supportLinearFiltering) {
    gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, 1.0 / simWidth, 1.0 / simHeight);
  }
  gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.texId); // 速度场（用于平流）
  gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read.texId);    // 源场（速度场自身）
  gl.uniform1f(advectionProgram.uniforms.dt, dt);                           // 时间步长
  gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION); // 速度耗散（模拟粘性）
  blit(velocity.write.fbo);
  velocity.swap();

  // ========================================================================
  // 步骤 4：涡度限制（Vorticity Confinement）
  // ========================================================================
  // 涡度限制是一种数值技术，用于增强和保持涡流效果
  // 由于数值耗散，小尺度的涡流会逐渐消失，涡度限制可以补偿这种损失
  // 
  // 步骤 4.1：计算速度场的旋度（Curl）
  // 旋度衡量速度场的旋转强度
  curlProgram.bind();
  gl.uniform2f(curlProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
  gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.texId);
  gl.uniform1i(curlProgram.uniforms.uNoise, noise.read.texId); // 可选：添加噪声
  gl.uniform1f(curlProgram.uniforms.blendLevel, config.NOISE_BLENDING);
  blit(curl.fbo); // 写入旋度场（单缓冲）
  
  // 步骤 4.2：应用涡度限制
  // 根据旋度场计算恢复力，增强涡流
  vorticityConfinementProgram.bind();
  gl.uniform2f(vorticityConfinementProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
  gl.uniform1i(vorticityConfinementProgram.uniforms.uVelocity, velocity.read.texId);
  gl.uniform1i(vorticityConfinementProgram.uniforms.uCurl, curl.texId); // 旋度场
  gl.uniform1f(vorticityConfinementProgram.uniforms.confinement, config.CONFINEMENT); // 限制强度
  gl.uniform1f(vorticityConfinementProgram.uniforms.dt, dt);
  blit(velocity.write.fbo);
  velocity.swap();

  // ========================================================================
  // 步骤 5：浮力（Buoyancy）
  // ========================================================================
  // 浮力是火焰上升的主要原因：热空气密度小，受到向上的浮力
  // 温度越高，浮力越大，速度的 Y 分量增加
  buoyancyProgram.bind();
  gl.uniform2f(buoyancyProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
  gl.uniform1i(buoyancyProgram.uniforms.uVelocity, velocity.read.texId);     // 速度场
  gl.uniform1i(buoyancyProgram.uniforms.uTemperature, temperature.read.texId); // 温度场
  gl.uniform1f(buoyancyProgram.uniforms.buoyancy, config.BUOYANCY);           // 浮力系数
  gl.uniform1f(buoyancyProgram.uniforms.dt, dt);
  blit(velocity.write.fbo);
  velocity.swap();

  // ========================================================================
  // 步骤 6：压力投影（Pressure Projection）
  // ========================================================================
  // 压力投影是流体模拟的关键步骤，用于使速度场满足不可压缩条件（div(u) = 0）
  // 这模拟了不可压缩流体的行为（如空气和水）
  // 
  // 步骤 6.1：压力耗散
  // 衰减压力场，模拟开放边界条件（压力可以向外释放）
  clearProgram.bind();
  let pressureTexId = pressure.read.texId;
  gl.activeTexture(gl.TEXTURE0 + pressureTexId);
  gl.bindTexture(gl.TEXTURE_2D, pressure.read.texture);
  gl.uniform1i(clearProgram.uniforms.uTexture, pressureTexId);
  gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE_DISSIPATION); // 压力耗散率
  blit(pressure.write.fbo);
  pressure.swap();

  // 步骤 6.2：计算速度场的散度
  // 散度衡量速度场的"源"或"汇"（divergence = ∂u/∂x + ∂v/∂y）
  // 对于不可压缩流体，散度应该为 0
  gl.viewport(0, 0, simWidth, simHeight);
  divergenceProgram.bind();
  gl.uniform2f(divergenceProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
  gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.texId);
  blit(divergence.fbo); // 写入散度场（单缓冲）
  
  // 步骤 6.3：使用 Jacobi 迭代法求解压力场
  // 求解泊松方程：∇²p = div(u)
  // 压力场用于修正速度场，使其无散
  pressureIterationProgram.bind();
  gl.uniform1i(pressureIterationProgram.uniforms.uPressure, pressureTexId);
  gl.uniform2f(pressureIterationProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
  gl.uniform1i(pressureIterationProgram.uniforms.uDivergence, divergence.texId);
  
  // 迭代求解（迭代次数越多，精度越高，但性能越低）
  for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
    gl.bindTexture(gl.TEXTURE_2D, pressure.read.texture);
    blit(pressure.write.fbo);
    pressure.swap(); // 每次迭代后交换缓冲区
  }
  
  // 步骤 6.4：从速度场中减去压力梯度
  // 这使速度场满足不可压缩条件：u_new = u_old - ∇p
  projectionProgram.bind();
  gl.uniform2f(projectionProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
  gl.uniform1i(projectionProgram.uniforms.uPressure, pressure.read.texId);
  gl.uniform1i(projectionProgram.uniforms.uVelocity, velocity.read.texId);
  blit(velocity.write.fbo);
  velocity.swap();

  // ========================================================================
  // 步骤 7：物质平流（Advection of Scalar Fields）
  // ========================================================================
  // 所有标量场（密度、温度、燃料、噪声）都随速度场移动
  // 这模拟了物质被流体携带的效果
  
  // 步骤 7.1：平流密度场（颜色/烟雾）
  // 密度场使用更高分辨率以获得更清晰的视觉效果
  advectionProgram.bind();
  gl.viewport(0, 0, dyeWidth, dyeHeight); // 使用密度场分辨率
  if (!ext.supportLinearFiltering) {
    gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, 1.0 / dyeWidth, 1.0 / dyeHeight);
  }
  gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.texId);
  gl.uniform1i(advectionProgram.uniforms.uSource, density.read.texId);
  gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION); // 密度耗散
  blit(density.write.fbo);
  density.swap();
  
  // 步骤 7.2：平流温度场
  gl.viewport(0, 0, simWidth, simHeight); // 切换回模拟分辨率
  if (!ext.supportLinearFiltering) {
    gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, 1.0 / simWidth, 1.0 / simHeight);
  }
  gl.uniform1i(advectionProgram.uniforms.uSource, temperature.read.texId);
  gl.uniform1f(advectionProgram.uniforms.dissipation, 1.0); // 温度不耗散（只通过冷却减少）
  blit(temperature.write.fbo);
  temperature.swap();
  
  // 步骤 7.3：平流燃料场
  gl.uniform1i(advectionProgram.uniforms.uSource, fuel.read.texId);
  gl.uniform1f(advectionProgram.uniforms.dissipation, config.FUEL_DISSIPATION); // 燃料耗散
  blit(fuel.write.fbo);
  fuel.swap();
  
  // 步骤 7.4：平流噪声场
  gl.uniform1i(advectionProgram.uniforms.uSource, noise.read.texId);
  gl.uniform1f(advectionProgram.uniforms.dissipation, 1.0); // 噪声不耗散
  blit(noise.write.fbo);
  noise.swap();

  // ========================================================================
  // 步骤 8：添加新噪声
  // ========================================================================
  // 持续添加噪声以保持湍流效果，使火焰更自然
  // 噪声随时间变化，产生动态的湍流效果
  addNoiseProgram.bind();
  gl.uniform2f(addNoiseProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
  gl.uniform1f(addNoiseProgram.uniforms.time, (new Date()).getTime() / 1.e4 % 1); // 时间参数（循环）
  gl.uniform1i(addNoiseProgram.uniforms.uTarget, noise.read.texId);
  gl.uniform1f(addNoiseProgram.uniforms.blendLevel, config.NOISE_VOLATILITY); // 噪声混合量
  blit(noise.write.fbo);
  noise.swap();

  // ========================================================================
  // 步骤 9：更新粒子系统
  // ========================================================================
  // 更新所有火焰粒子发射器（平流粒子、更新生命周期等）
  fireSources.forEach(fireSource => fireSource.step(dt));
}

// ============================================================================
// 主初始化函数
// ============================================================================
/**
 * 主初始化函数
 * 
 * 初始化所有 WebGL 程序、帧缓冲，并启动主循环。
 */
function main () {
  // 创建所有 WebGL 程序
  // 根据设备能力选择不同的着色器（例如是否支持线性过滤）
  advectionProgram =
    new GLProgram(
      shaders.baseVertexShader,
      ext.supportLinearFiltering ? shaders.advectionShader : shaders.advectionManualFilteringShader
    );
  addNoiseProgram           = new GLProgram(shaders.baseVertexShader, shaders.addNoiseShader);
  buoyancyProgram           = new GLProgram(shaders.baseVertexShader, shaders.buoyancyShader);
  clearProgram              = new GLProgram(shaders.baseVertexShader, shaders.clearShader);
  combustionProgram         = new GLProgram(shaders.baseVertexShader, shaders.combustionShader);
  curlProgram               = new GLProgram(shaders.baseVertexShader, shaders.curlShader);
  debugFireProgram          = new GLProgram(shaders.baseVertexShader, shaders.debugFireShader);
  debugFloatProgram         = new GLProgram(shaders.baseVertexShader, shaders.debugFloatShader);
  displayProgram            = new GLProgram(shaders.baseVertexShader, shaders.displayShader);
  displayFireProgram        = new GLProgram(shaders.baseVertexShader, shaders.displayFireShader);
  divergenceProgram         = new GLProgram(shaders.baseVertexShader, shaders.divergenceShader);
  particlesAdvectionProgram = new GLProgram(shaders.baseVertexShader, shaders.particlesAdvectionShader);
  particlesRenderProgram    = new GLProgram(shaders.particlesVertexShader, shaders.particlesRenderShader);
  particlesResetDataProgram = new GLProgram(shaders.baseVertexShader, shaders.particlesResetDataShader);
  particlesResetLifespanProgram = new GLProgram(shaders.baseVertexShader, shaders.particlesResetLifespanShader);
  particlesStepLifespanProgram = new GLProgram(shaders.baseVertexShader, shaders.particlesStepLifespanShader);
  pressureIterationProgram  = new GLProgram(shaders.baseVertexShader, shaders.pressureIterationShader);
  projectionProgram         = new GLProgram(shaders.baseVertexShader, shaders.projectionShader);
  rowProgram                = new GLProgram(shaders.baseVertexShader, shaders.rowShader);
  splatProgram              = new GLProgram(shaders.baseVertexShader, shaders.splatShader);
  vorticityConfinementProgram = new GLProgram(shaders.baseVertexShader, shaders.vorticityConfinementShader);

  // 初始化所有帧缓冲（速度、密度、温度、燃料等）
  initFramebuffers();

  // 初始化噪声通道
  // 使用随机噪声填充噪声场，为后续的湍流效果提供基础
  addNoiseProgram.bind();
  gl.uniform2f(addNoiseProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
  gl.uniform1f(addNoiseProgram.uniforms.time, (new Date()).getTime() / 1.e6 % 1); // 随机时间种子
  gl.uniform1i(addNoiseProgram.uniforms.uTarget, noise.read.texId);
  gl.uniform1f(addNoiseProgram.uniforms.blendLevel, 1.0); // 完全替换（初始化）
  blit(noise.write.fbo);
  noise.swap();

  // 启动主循环
  update();
}

// ============================================================================
// 事件处理
// ============================================================================
// 鼠标移动事件：更新指针位置和速度
canvas.addEventListener('mousemove', (e) => {
  pointers[0].moved = pointers[0].down; // 只有在按下时才标记为移动
  // 计算速度（位置差乘以缩放因子）
  pointers[0].dx = (e.offsetX - pointers[0].x) * 5.0;
  pointers[0].dy = (e.offsetY - pointers[0].y) * 5.0;
  // 更新位置
  pointers[0].x = e.offsetX;
  pointers[0].y = e.offsetY;
});

// 触摸移动事件：支持多点触摸
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault(); // 阻止默认滚动行为
  const touches = e.targetTouches;
  for (let i = 0; i < touches.length; i++) {
    let pointer = pointers[i];
    pointer.moved = pointer.down;
    // 计算速度（触摸移动速度更快，使用更大的缩放因子）
    pointer.dx = (touches[i].pageX - pointer.x) * 8.0;
    pointer.dy = (touches[i].pageY - pointer.y) * 8.0;
    pointer.x = touches[i].pageX;
    pointer.y = touches[i].pageY;
  }
}, false);

// 鼠标按下事件：开始交互
canvas.addEventListener('mousedown', () => {
  pointers[0].down = true;
  pointers[0].color = generateColor(); // 为此次交互生成随机颜色
});

// 触摸开始事件：支持多点触摸
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touches = e.targetTouches;
  for (let i = 0; i < touches.length; i++) {
    // 如果触摸点超过现有指针数，创建新指针
    if (i >= pointers.length) {
      pointers.push(new pointerPrototype());
    }

    pointers[i].id = touches[i].identifier; // 存储触摸 ID（用于跟踪）
    pointers[i].down = true;
    pointers[i].x = touches[i].pageX;
    pointers[i].y = touches[i].pageY;
    pointers[i].color = generateColor();
  }
});

// 鼠标释放事件
window.addEventListener('mouseup', () => {
  pointers[0].down = false;
});

// 触摸结束事件：根据触摸 ID 匹配并释放相应的指针
window.addEventListener('touchend', (e) => {
  const touches = e.changedTouches;
  for (let i = 0; i < touches.length; i++)
    for (let j = 0; j < pointers.length; j++)
      if (touches[i].identifier == pointers[j].id)
        pointers[j].down = false;
});

// 键盘事件：空格键切换显示模式
window.addEventListener('keydown', (e) => {
  if (e.key === " ") {
    config.DISPLAY_MODE = (config.DISPLAY_MODE + 1) % DISPLAY_MODES.length;
  }
});

// ============================================================================
// 辅助函数
// ============================================================================
/**
 * 指针原型构造函数
 * 
 * 创建指针对象，用于跟踪鼠标/触摸输入
 */
function pointerPrototype () {
    this.id = -1;      // 触摸 ID（鼠标为 -1）
    this.x = 0;        // X 坐标
    this.y = 0;        // Y 坐标
    this.dx = 0;       // X 方向速度
    this.dy = 0;       // Y 方向速度
    this.down = false;  // 是否按下
    this.moved = false; // 是否移动
    this.color = [30, 0, 300]; // 默认颜色（未使用）
}

/**
 * 生成随机颜色
 * 
 * 用于用户交互时的颜色扰动
 * 
 * @returns {Object} 颜色对象 {r, g, b}，值在 [0.05, 0.2] 范围内
 */
function generateColor () {
  return {
    r: Math.random() * 0.15 + 0.05, // 红色分量
    g: Math.random() * 0.15 + 0.05, // 绿色分量
    b: Math.random() * 0.15 + 0.05, // 蓝色分量
  };
}

// ============================================================================
// 程序入口
// ============================================================================
// 启动程序
main();
