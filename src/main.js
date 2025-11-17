import vertexShaderSource from "./shaders/fire.vert.glsl";
import fragmentShaderSource from "./shaders/fire.frag.glsl";
import updateVert from "./shaders/particles_update.vert.glsl";
import updateFrag from "./shaders/particles_update.frag.glsl";
import renderVert from "./shaders/particles_render.vert.glsl";
import renderFrag from "./shaders/particles_render.frag.glsl";
import velAdvectFrag from "./shaders/vel_advect.frag.glsl";
import tempAdvectFrag from "./shaders/temp_advect.frag.glsl";
import velForceFrag from "./shaders/vel_force.frag.glsl";
import { compileShader, createProgram, createQuadBuffer, createFloatTexture, createFramebuffer, createVertexArray } from "./utility.js";

const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

if (!gl) {
  alert('WebGL not supported');
  throw new Error('WebGL not supported');
}

// Set canvas size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
// 可调参数：粒子/场尺寸、动力学与视觉映射
const params = {
  texSize: 256,
  forceUp: 0.35,    // 粒子上升力（保留少量对粒子的直接控制）
  damping: 0.965,   // 粒子速度阻尼
  noise: 0.06,      // 粒子横向噪声幅度
  vyMax: 0.6,       // 粒子最大上升速度
  spawn: 0.02,      // 持续点火概率
  buoy: 0.8,        // 热浮力系数
  vorticity: 1.5,   // 涡度约束强度
  dissV: 0.995,     // 速度耗散
  dissT: 0.992,     // 温度耗散
  srcIntensity: 0.35, // 底部热源强度
  srcRadius: 0.06,  // 底部热源半径
  warmth: 0.95,     // 色温偏移
  brightness: 0.9,  // 亮度缩放
  gamma: 1.6,       // 颜色Gamma
  lowCut: 0.1,      // 低温截断
  highCut: 0.85     // 高温截断
};
let program = null;
let updateProgram = null;
let renderProgram = null;
let velAdvectProgram = null;
let tempAdvectProgram = null;
let velForceProgram = null;
let positionBuffer = null;
let vaoUpdate = null;
let vaoRender = null;
let stateTexA = null;
let stateTexB = null;
let velTexA = null;
let velTexB = null;
let tempTexA = null;
let tempTexB = null;
let fbA = null;
let fbB = null;
let fbVelA = null;
let fbVelB = null;
let fbTempA = null;
let fbTempB = null;
let texSize = params.texSize;
let particleCount = texSize * texSize;
if (isWebGL2) {
  // 编译各Pass程序：
  // - updateProgram：通用全屏顶点 + 粒子/场片元（复用顶点着色器）
  // - velAdvectProgram：速度半拉格朗日对流
  // - tempAdvectProgram：温度半拉格朗日对流 + 底部热源
  // - velForceProgram：涡度约束 + 热浮力施力
  const ext = gl.getExtension('EXT_color_buffer_float');
  const uVS = compileShader(gl, gl.VERTEX_SHADER, updateVert);
  const uFS = compileShader(gl, gl.FRAGMENT_SHADER, updateFrag);
  updateProgram = createProgram(gl, uVS, uFS);
  const rVS = compileShader(gl, gl.VERTEX_SHADER, renderVert);
  const rFS = compileShader(gl, gl.FRAGMENT_SHADER, renderFrag);
  renderProgram = createProgram(gl, rVS, rFS);
  const aVS = compileShader(gl, gl.VERTEX_SHADER, updateVert);
  const vAFS = compileShader(gl, gl.FRAGMENT_SHADER, velAdvectFrag);
  velAdvectProgram = createProgram(gl, aVS, vAFS);
  const tAFS = compileShader(gl, gl.FRAGMENT_SHADER, tempAdvectFrag);
  tempAdvectProgram = createProgram(gl, aVS, tAFS);
  const vFFS = compileShader(gl, gl.FRAGMENT_SHADER, velForceFrag);
  velForceProgram = createProgram(gl, aVS, vFFS);
  positionBuffer = createQuadBuffer(gl);
  vaoUpdate = createVertexArray(gl);
  gl.bindVertexArray(vaoUpdate);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const aPosLoc = gl.getAttribLocation(updateProgram, 'aPos');
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  vaoRender = createVertexArray(gl);
  // 初始化粒子状态：底部喷口附近位置与向上速度
  const init = new Float32Array(particleCount * 4);
  for (let i = 0; i < particleCount; i++) {
    const rx = Math.random();
    const ry = Math.random();
    const px = 0.5 + (rx - 0.5) * 0.08;
    const py = 0.02 + ry * 0.02;
    const vx = (rx - 0.5) * 0.08;
    const vy = 0.35 + ry * 0.2;
    const o = i * 4;
    init[o + 0] = px;
    init[o + 1] = py;
    init[o + 2] = vx;
    init[o + 3] = vy;
  }
  // 双缓冲纹理与FBO：粒子、速度、温度
  stateTexA = createFloatTexture(gl, texSize, texSize, init);
  stateTexB = createFloatTexture(gl, texSize, texSize, null);
  velTexA = createFloatTexture(gl, texSize, texSize, null);
  velTexB = createFloatTexture(gl, texSize, texSize, null);
  tempTexA = createFloatTexture(gl, texSize, texSize, null);
  tempTexB = createFloatTexture(gl, texSize, texSize, null);
  fbA = createFramebuffer(gl, stateTexA);
  fbB = createFramebuffer(gl, stateTexB);
  fbVelA = createFramebuffer(gl, velTexA);
  fbVelB = createFramebuffer(gl, velTexB);
  fbTempA = createFramebuffer(gl, tempTexA);
  fbTempB = createFramebuffer(gl, tempTexB);
} else {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  program = createProgram(gl, vertexShader, fragmentShader);
  positionBuffer = createQuadBuffer(gl);
}

 

let positionLocation = null;
let timeLocation = null;
let resolutionLocation = null;
let uPosLocation = null;
let uDeltaLocation = null;
let uTimeLocation = null;
let uTexSizeLocation = null;
let uForceLocation = null;
let uDampingLocation = null;
let uNoiseLocation = null;
let uVyMaxLocation = null;
let uSpawnLocation = null;
let uVelSamplerLocation = null;
let uTempSamplerLocation = null;
let rStateLocation = null;
let rTexSizeLocation = null;
let rResolutionLocation = null;
let rTimeLocation = null;
let rTempSamplerLocation = null;
let rWarmthLocation = null;
let rBrightnessLocation = null;
let rGammaLocation = null;
let rLowCutLocation = null;
let rHighCutLocation = null;
let vAdvDeltaLocation = null;
let vAdvDissLocation = null;
let tAdvDeltaLocation = null;
let tAdvDissLocation = null;
let tAdvSrcIntensityLocation = null;
let tAdvSrcCenterLocation = null;
let tAdvSrcRadiusLocation = null;
let tAdvTimeLocation = null;
let vForceDeltaLocation = null;
let vForceGridLocation = null;
let vForceEpsLocation = null;
let vForceBuoyLocation = null;
let vForceDampLocation = null;
if (!isWebGL2) {
  positionLocation = gl.getAttribLocation(program, 'aPos');
  timeLocation = gl.getUniformLocation(program, 'uTime');
  resolutionLocation = gl.getUniformLocation(program, 'uResolution');
} else {
  // 位置/Uniform查询（WebGL2路径）
  uPosLocation = gl.getAttribLocation(updateProgram, 'aPos');
  uDeltaLocation = gl.getUniformLocation(updateProgram, 'uDelta');
  uTimeLocation = gl.getUniformLocation(updateProgram, 'uTime');
  uTexSizeLocation = gl.getUniformLocation(updateProgram, 'uTexSize');
  uForceLocation = gl.getUniformLocation(updateProgram, 'uForceUp');
  uDampingLocation = gl.getUniformLocation(updateProgram, 'uDamping');
  uNoiseLocation = gl.getUniformLocation(updateProgram, 'uNoise');
  uVyMaxLocation = gl.getUniformLocation(updateProgram, 'uVyMax');
  uSpawnLocation = gl.getUniformLocation(updateProgram, 'uSpawn');
  uVelSamplerLocation = gl.getUniformLocation(updateProgram, 'uVelTex');
  uTempSamplerLocation = gl.getUniformLocation(updateProgram, 'uTempTex');
  rStateLocation = gl.getUniformLocation(renderProgram, 'uStateTex');
  rTexSizeLocation = gl.getUniformLocation(renderProgram, 'uTexSize');
  rResolutionLocation = gl.getUniformLocation(renderProgram, 'uResolution');
  rTimeLocation = gl.getUniformLocation(renderProgram, 'uTime');
  rTempSamplerLocation = gl.getUniformLocation(renderProgram, 'uTempTex');
  rWarmthLocation = gl.getUniformLocation(renderProgram, 'uWarmth');
  rBrightnessLocation = gl.getUniformLocation(renderProgram, 'uBrightness');
  rGammaLocation = gl.getUniformLocation(renderProgram, 'uGamma');
  rLowCutLocation = gl.getUniformLocation(renderProgram, 'uLowCut');
  rHighCutLocation = gl.getUniformLocation(renderProgram, 'uHighCut');
  vAdvDeltaLocation = gl.getUniformLocation(velAdvectProgram, 'uDelta');
  vAdvDissLocation = gl.getUniformLocation(velAdvectProgram, 'uDiss');
  tAdvDeltaLocation = gl.getUniformLocation(tempAdvectProgram, 'uDelta');
  tAdvDissLocation = gl.getUniformLocation(tempAdvectProgram, 'uDissT');
  tAdvSrcIntensityLocation = gl.getUniformLocation(tempAdvectProgram, 'uSrcIntensity');
  tAdvSrcCenterLocation = gl.getUniformLocation(tempAdvectProgram, 'uSourceCenter');
  tAdvSrcRadiusLocation = gl.getUniformLocation(tempAdvectProgram, 'uSourceRadius');
  tAdvTimeLocation = gl.getUniformLocation(tempAdvectProgram, 'uTime');
  vForceDeltaLocation = gl.getUniformLocation(velForceProgram, 'uDelta');
  vForceGridLocation = gl.getUniformLocation(velForceProgram, 'uGridSize');
  vForceEpsLocation = gl.getUniformLocation(velForceProgram, 'uEps');
  vForceBuoyLocation = gl.getUniformLocation(velForceProgram, 'uBuoy');
  vForceDampLocation = gl.getUniformLocation(velForceProgram, 'uDamp');
}

// Render loop
let startTime = Date.now();
let lastTime = Date.now();
let ping = true;
let vPing = true;
let tPing = true;

function render() {
  const now = Date.now();
  const currentTime = (now - startTime) / 1000.0;
  const delta = (now - lastTime) / 1000.0;
  lastTime = now;
  gl.viewport(0, 0, canvas.width, canvas.height);
  if (isWebGL2) {
    // Pass 1：速度对流
    gl.bindFramebuffer(gl.FRAMEBUFFER, vPing ? fbVelB : fbVelA);
    gl.viewport(0, 0, texSize, texSize);
    gl.useProgram(velAdvectProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, vPing ? velTexA : velTexB);
    gl.uniform1i(gl.getUniformLocation(velAdvectProgram,'uVelSrc'),0);
    gl.uniform1f(vAdvDeltaLocation, delta);
    gl.uniform1f(vAdvDissLocation, params.dissV);
    gl.bindVertexArray(vaoUpdate);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // Pass 2：温度对流 + 热源注入
    gl.bindFramebuffer(gl.FRAMEBUFFER, tPing ? fbTempB : fbTempA);
    gl.viewport(0, 0, texSize, texSize);
    gl.useProgram(tempAdvectProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tPing ? tempTexA : tempTexB);
    gl.uniform1i(gl.getUniformLocation(tempAdvectProgram,'uTempSrc'),0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, vPing ? velTexB : velTexA);
    gl.uniform1i(gl.getUniformLocation(tempAdvectProgram,'uVelTex'),1);
    gl.uniform1f(tAdvDeltaLocation, delta);
    gl.uniform1f(tAdvDissLocation, params.dissT);
    gl.uniform1f(tAdvSrcIntensityLocation, params.srcIntensity);
    gl.uniform2f(tAdvSrcCenterLocation, 0.5, 0.03);
    gl.uniform1f(tAdvSrcRadiusLocation, params.srcRadius);
    gl.uniform1f(tAdvTimeLocation, currentTime);
    gl.uniform1f(gl.getUniformLocation(tempAdvectProgram,'uUpBase'), params.upBase);
    gl.bindVertexArray(vaoUpdate);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // Pass 3：速度施力（涡度约束+热浮力）
    gl.bindFramebuffer(gl.FRAMEBUFFER, vPing ? fbVelA : fbVelB);
    gl.viewport(0, 0, texSize, texSize);
    gl.useProgram(velForceProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, vPing ? velTexB : velTexA);
    gl.uniform1i(gl.getUniformLocation(velForceProgram,'uVelSrc'),0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tPing ? tempTexB : tempTexA);
    gl.uniform1i(gl.getUniformLocation(velForceProgram,'uTempTex'),1);
    gl.uniform1f(vForceDeltaLocation, delta);
    gl.uniform1f(vForceGridLocation, texSize);
    gl.uniform1f(vForceEpsLocation, params.vorticity);
    gl.uniform1f(vForceBuoyLocation, params.buoy);
    gl.uniform1f(vForceDampLocation, params.dissV);
    gl.bindVertexArray(vaoUpdate);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // Pass 4：粒子状态更新（采样速度/温度场）
    gl.bindFramebuffer(gl.FRAMEBUFFER, ping ? fbB : fbA);
    gl.viewport(0, 0, texSize, texSize);
    gl.useProgram(updateProgram);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, vPing ? velTexA : velTexB);
    gl.uniform1i(uVelSamplerLocation, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, tPing ? tempTexB : tempTexA);
    gl.uniform1i(uTempSamplerLocation, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ping ? stateTexA : stateTexB);
    const loc = gl.getUniformLocation(updateProgram, 'uStateTex');
    gl.uniform1i(loc, 0);
    gl.uniform1f(uDeltaLocation, delta);
    gl.uniform1f(uTimeLocation, currentTime);
    gl.uniform1f(uTexSizeLocation, texSize);
    gl.uniform1f(uForceLocation, params.forceUp);
    gl.uniform1f(uDampingLocation, params.damping);
    gl.uniform1f(uNoiseLocation, params.noise);
    gl.uniform1f(uVyMaxLocation, params.vyMax);
    gl.uniform1f(uSpawnLocation, params.spawn);
    gl.bindVertexArray(vaoUpdate);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // 屏幕渲染：点精灵叠加（加色混合）
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(renderProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ping ? stateTexB : stateTexA);
    gl.uniform1i(rStateLocation, 0);
    gl.uniform1f(rTexSizeLocation, texSize);
    gl.uniform2f(rResolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(rTimeLocation, currentTime);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tPing ? tempTexB : tempTexA);
    gl.uniform1i(rTempSamplerLocation, 1);
    gl.uniform1f(rWarmthLocation, params.warmth);
    gl.uniform1f(rBrightnessLocation, params.brightness);
    gl.uniform1f(rGammaLocation, params.gamma);
    gl.uniform1f(rLowCutLocation, params.lowCut);
    gl.uniform1f(rHighCutLocation, params.highCut);
    gl.bindVertexArray(vaoRender);
    gl.drawArrays(gl.POINTS, 0, particleCount);
    gl.disable(gl.BLEND);
    ping = !ping;
    vPing = !vPing;
    tPing = !tPing;
  } else {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform1f(timeLocation, currentTime);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  requestAnimationFrame(render);
}

render();

if (isWebGL2) {
  const elTex = document.getElementById('texSize');
  const elForce = document.getElementById('forceUp');
  const elDamp = document.getElementById('damping');
  const elNoise = document.getElementById('noise');
  const elVyMax = document.getElementById('vyMax');
  const elSpawn = document.getElementById('spawn');
  const elWarmth = document.createElement('input'); elWarmth.type='range'; elWarmth.min='0.5'; elWarmth.max='1.5'; elWarmth.step='0.01'; elWarmth.value=String(params.warmth);
  const elBright = document.createElement('input'); elBright.type='range'; elBright.min='0.5'; elBright.max='2.0'; elBright.step='0.01'; elBright.value=String(params.brightness);
  const elGamma = document.createElement('input'); elGamma.type='range'; elGamma.min='0.8'; elGamma.max='2.5'; elGamma.step='0.01'; elGamma.value=String(params.gamma);
  const elLow = document.createElement('input'); elLow.type='range'; elLow.min='0.0'; elLow.max='0.5'; elLow.step='0.01'; elLow.value=String(params.lowCut);
  const elHigh = document.createElement('input'); elHigh.type='range'; elHigh.min='0.5'; elHigh.max='1.0'; elHigh.step='0.01'; elHigh.value=String(params.highCut);
  const elBuoy = document.createElement('input'); elBuoy.type='range'; elBuoy.min='0.0'; elBuoy.max='2.0'; elBuoy.step='0.05'; elBuoy.value=String(params.buoy);
  const elVort = document.createElement('input'); elVort.type='range'; elVort.min='0.0'; elVort.max='3.0'; elVort.step='0.05'; elVort.value=String(params.vorticity);
  const elSrcI = document.createElement('input'); elSrcI.type='range'; elSrcI.min='0.0'; elSrcI.max='1.0'; elSrcI.step='0.01'; elSrcI.value=String(params.srcIntensity);
  const panel=document.getElementById('panel');
  const r1=document.createElement('div'); r1.textContent='Buoyancy'; panel.appendChild(r1); panel.appendChild(elBuoy);
  const r2=document.createElement('div'); r2.textContent='Vorticity'; panel.appendChild(r2); panel.appendChild(elVort);
  const r3=document.createElement('div'); r3.textContent='TempSrc'; panel.appendChild(r3); panel.appendChild(elSrcI);
  const r4=document.createElement('div'); r4.textContent='Warmth'; panel.appendChild(r4); panel.appendChild(elWarmth);
  const r5=document.createElement('div'); r5.textContent='Brightness'; panel.appendChild(r5); panel.appendChild(elBright);
  const r6=document.createElement('div'); r6.textContent='Gamma'; panel.appendChild(r6); panel.appendChild(elGamma);
  const r7=document.createElement('div'); r7.textContent='LowCut'; panel.appendChild(r7); panel.appendChild(elLow);
  const r8=document.createElement('div'); r8.textContent='HighCut'; panel.appendChild(r8); panel.appendChild(elHigh);
  function recreate(size) {
    texSize = size;
    particleCount = texSize * texSize;
    if (fbA) gl.deleteFramebuffer(fbA);
    if (fbB) gl.deleteFramebuffer(fbB);
    if (stateTexA) gl.deleteTexture(stateTexA);
    if (stateTexB) gl.deleteTexture(stateTexB);
    const init = new Float32Array(particleCount * 4);
    for (let i = 0; i < particleCount; i++) {
      const rx = Math.random();
      const ry = Math.random();
      const px = 0.5 + (rx - 0.5) * 0.08;
      const py = 0.02 + ry * 0.02;
      const vx = (rx - 0.5) * 0.08;
      const vy = 0.35 + ry * 0.2;
      const o = i * 4;
      init[o + 0] = px;
      init[o + 1] = py;
      init[o + 2] = vx;
      init[o + 3] = vy;
    }
    stateTexA = createFloatTexture(gl, texSize, texSize, init);
    stateTexB = createFloatTexture(gl, texSize, texSize, null);
    fbA = createFramebuffer(gl, stateTexA);
    fbB = createFramebuffer(gl, stateTexB);
  }
  elTex.addEventListener('change', () => {
    const v = parseInt(elTex.value, 10);
    params.texSize = v;
    recreate(v);
  });
  elForce.addEventListener('input', () => {
    params.forceUp = parseFloat(elForce.value);
  });
  elDamp.addEventListener('input', () => {
    params.damping = parseFloat(elDamp.value);
  });
  elNoise.addEventListener('input', () => {
    params.noise = parseFloat(elNoise.value);
  });
  elVyMax.addEventListener('input', () => {
    params.vyMax = parseFloat(elVyMax.value);
  });
  elSpawn.addEventListener('input', () => {
    params.spawn = parseFloat(elSpawn.value);
  });
  elWarmth.addEventListener('input', () => { params.warmth = parseFloat(elWarmth.value); });
  elBright.addEventListener('input', () => { params.brightness = parseFloat(elBright.value); });
  elGamma.addEventListener('input', () => { params.gamma = parseFloat(elGamma.value); });
  elLow.addEventListener('input', () => { params.lowCut = parseFloat(elLow.value); });
  elHigh.addEventListener('input', () => { params.highCut = parseFloat(elHigh.value); });
  elBuoy.addEventListener('input', () => { params.buoy = parseFloat(elBuoy.value); });
  elVort.addEventListener('input', () => { params.vorticity = parseFloat(elVort.value); });
  elSrcI.addEventListener('input', () => { params.srcIntensity = parseFloat(elSrcI.value); });
}
