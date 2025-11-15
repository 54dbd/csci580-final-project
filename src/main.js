import vertShader from "./shaders/fire.vert.glsl";
import fragShader from "./shaders/fire.frag.glsl";
import particleVert from "./shaders/particle.vert.glsl";
import particleFrag from "./shaders/particle.frag.glsl";
import {getWebGLContext,createShaderProgram,createProgram,createShader} from "./utility"


const canvas = document.getElementById("glcanvas");


const { gl, ext } = getWebGLContext(canvas);


// Resize the canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertShader);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragShader);
const program = createProgram(gl, vertexShader, fragmentShader);


// Vertex data
const vertices = new Float32Array([
    -1, -1,
    3, -1,
    -1, 3
]);
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const aPos = gl.getAttribLocation(program, "aPos");
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

// Uniforms
const uTime = gl.getUniformLocation(program, "uTime");
const uResolution = gl.getUniformLocation(program, "uResolution");

// ---------------- Particle system (CPU-driven) ----------------

const particleProgram = createShaderProgram(gl, particleVert, particleFrag);
const p_uResolution = gl.getUniformLocation(particleProgram, "uResolution");
const p_uColor = gl.getUniformLocation(particleProgram, "uColor");
const p_uAlpha = gl.getUniformLocation(particleProgram, "uAlpha");

const MAX_PARTICLES = 1000;
const particles = [];

function spawnParticle() {
    const p = {
        x: canvas.width * 0.5 + (Math.random() - 0.5) * 80,
        y: canvas.height - 60 + (Math.random() - 1.0) * 30,
        vx: (Math.random() - 0.5) * 40,
        vy: -50 - Math.random() * 80,
        life: 0.8 + Math.random() * 1.2,
        age: 0,
        size: 8 + Math.random() * 16,
        color: [1.0, 0.5 + Math.random() * 0.5, 0.2]
    };
    particles.push(p);
}

const particlePosArray = new Float32Array(MAX_PARTICLES * 2);
const particleBuffer = gl.createBuffer();

function updateParticleBuffer() {
    let count = 0;
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.age >= p.life) {
            particles.splice(i, 1);
            continue;
        }
        particlePosArray[count * 2 + 0] = p.x;
        particlePosArray[count * 2 + 1] = p.y;
        count++;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    // Upload full array; gl.bufferSubData could be used for smaller updates
    gl.bufferData(gl.ARRAY_BUFFER, particlePosArray, gl.DYNAMIC_DRAW);
    return count;
}

// Get particle attribute location from compiled program
const p_aPos = particleProgram ? gl.getAttribLocation(particleProgram, "aPos") : -1;


// Render loop
let start = Date.now();
function render() {
    const now = Date.now();
    const time = (now - start) / 1000;
    gl.useProgram(program);
    gl.uniform1f(uTime, time);
    gl.uniform2f(uResolution, canvas.width, canvas.height);

    // Draw background/fire full-screen triangle
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Spawn a few particles each frame (simple emitter)
    if (particles.length < MAX_PARTICLES) {
        for (let i = 0; i < 4; i++) {
            if (Math.random() < 0.7) spawnParticle();
        }
    }

    // Update particles (simple Euler integration)
    const dt = 1 / 60;
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        // small upward acceleration to simulate fire rise
        p.vy += -30 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.age += dt;
    }

    // Upload positions and draw particles
    const count = updateParticleBuffer();
    if (count > 0) {
        gl.useProgram(particleProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
        gl.enableVertexAttribArray(p_aPos);
        gl.vertexAttribPointer(p_aPos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(p_uResolution, canvas.width, canvas.height);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        // Draw particles individually so we can vary color/alpha per particle
        for (let i = 0; i < count; i++) {
            const p = particles[i];
            const lifeRatio = 1.0 - (p.age / p.life);
            gl.uniform3f(p_uColor, p.color[0], p.color[1], p.color[2]);
            gl.uniform1f(p_uAlpha, lifeRatio);
            gl.drawArrays(gl.POINTS, i, 1);
        }

        gl.disable(gl.BLEND);
        // Restore fire shader program and attributes
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }

    requestAnimationFrame(render);
}

render();
