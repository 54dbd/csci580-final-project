import vertexShaderSource from "./shaders/fire.vert.glsl";
import fragmentShaderSource from "./shaders/fire.frag.glsl";
import { compileShader, createProgram, createQuadBuffer } from "./utility.js";

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

// Compile shaders
const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);

// Create full-screen quad
const positionBuffer = createQuadBuffer(gl);

// Get attribute and uniform locations
const positionLocation = gl.getAttribLocation(program, 'aPos');
const timeLocation = gl.getUniformLocation(program, 'uTime');
const resolutionLocation = gl.getUniformLocation(program, 'uResolution');

// Render loop
let startTime = Date.now();

function render() {
  const currentTime = (Date.now() - startTime) / 1000.0;
  
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  
  // Set uniforms
  gl.uniform1f(timeLocation, currentTime);
  gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
  
  // Set attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  
  // Draw
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  
  requestAnimationFrame(render);
}

render();
