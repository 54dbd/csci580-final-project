# Particle-Based Fire Simulation

A WebGL-based fire simulation project using particle systems. This project implements realistic fire effects through GPU-accelerated particle simulation, where each particle represents a tiny piece of fire with its own lifecycle, movement, and visual properties.

## Features

- ✅ Basic WebGL setup with minimal boilerplate
- ✅ Modular utility functions for shader compilation and rendering
- ✅ Full-screen quad rendering pipeline
- ✅ Time-based animation support
- 🔄 GPU-based particle system (to be implemented)
- 🔄 Particle physics simulation (velocity, acceleration, lifecycle)
- 🔄 Heat-based particle behavior and color mapping

## Tech Stack

- **WebGL 2.0** / WebGL 1.0 (with fallback)
- **GLSL** for shader programming
- **Vite** for development and build tooling
- **JavaScript ES6+** with modules

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd csci580-final-project
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173/`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Project Structure

```
csci580-final-project/
├── src/
│   ├── main.js              # Main application entry point
│   ├── utility.js           # WebGL utility functions
│   └── shaders/
│       ├── fire.vert.glsl   # Vertex shader
│       └── fire.frag.glsl   # Fragment shader (implement fire effect here)
├── index.html               # HTML entry point
├── package.json             # Project dependencies
└── vite.config.js          # Vite configuration
```

## Development Guide

### Particle System Architecture

This fire simulation uses a GPU-based particle system where particles are stored in textures and updated using fragment shaders. The architecture includes:

1. **Particle State Storage** - Textures storing particle data:
   - Position (x, y)
   - Velocity (vx, vy)
   - Temperature/Heat
   - Lifespan/Age

2. **Update Shaders** - Fragment shaders that update particle state each frame:
   - Physics simulation (gravity, turbulence)
   - Heat dissipation
   - Lifecycle management

3. **Render Shaders** - Vertex and fragment shaders for visualizing particles:
   - Color mapping based on temperature
   - Particle blending and transparency
   - Glow/bloom effects

### Implementation Steps

1. **Initialize Particle Data** - Create textures to store particle properties
2. **Particle Update Pass** - Use ping-pong buffers to update particle state
3. **Particle Rendering Pass** - Render particles as points with additive blending
4. **Visual Effects** - Apply heat-based color gradients and transparency

Example particle rendering approach:

```glsl
// Vertex Shader - Transform particle positions
attribute vec2 aParticleUV;
uniform sampler2D uParticleData;

void main() {
    vec4 data = texture2D(uParticleData, aParticleUV);
    vec2 position = data.xy;
    gl_Position = vec4(position, 0.0, 1.0);
    gl_PointSize = 5.0;
}

// Fragment Shader - Color based on temperature
uniform float uTemperature;

void main() {
    // Hot = white/yellow, Medium = orange, Cool = red
    vec3 color = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 1.0, 0.8), uTemperature);
    gl_FragColor = vec4(color, 0.5);
}
```

### Utility Functions

The `utility.js` module provides reusable WebGL functions:

- `compileShader(gl, type, source)` - Compile vertex or fragment shaders
- `createProgram(gl, vertexShader, fragmentShader)` - Link shaders into a program
- `createQuadBuffer(gl)` - Create a full-screen quad for rendering

## Roadmap

### Phase 1: Basic Particle System
- [ ] Create particle data textures (position, velocity)
- [ ] Implement particle spawning at fire source
- [ ] Basic particle physics (gravity, upward force)
- [ ] Particle lifecycle management

### Phase 2: Visual Enhancements
- [ ] Temperature-based color mapping (white → yellow → orange → red → black)
- [ ] Additive blending for glow effect
- [ ] Particle size variation based on lifecycle
- [ ] Alpha transparency for realistic fading

### Phase 3: Physics and Realism
- [ ] Turbulence and noise for natural movement
- [ ] Heat dissipation over particle lifetime
- [ ] Velocity damping and randomization
- [ ] Wind/external force influence

### Phase 4: Advanced Features
- [ ] Multiple fire sources
- [ ] Interactive controls (fire intensity, particle count)
- [ ] Smoke particles (darker, slower particles)
- [ ] Ember particles (falling sparks)
- [ ] Performance optimization for mobile devices

### Phase 5: Polish
- [ ] Post-processing effects (bloom, glow)
- [ ] Responsive design
- [ ] Configuration UI panel
- [ ] Export/record animation

## License

See [LICENSE](LICENSE) file for details.

## Acknowledgments

This project was created as part of CSCI 580 coursework.

