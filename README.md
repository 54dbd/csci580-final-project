# Particle-Based Fire Simulation

A WebGL-based fire simulation project implementing realistic fire effects through GPU-accelerated fluid dynamics. This project uses a combination of particle systems and fluid simulation based on the Navier-Stokes equations to create physically accurate fire behavior, including combustion, buoyancy, and thermal dynamics.

## Features

- ✅ **GPU-Accelerated Fluid Simulation** - Real-time Navier-Stokes equation solver
- ✅ **Particle System** - Fire particles with lifecycle and physics simulation
- ✅ **Physical Fields** - Velocity, temperature, fuel, density, and pressure fields
- ✅ **Combustion Model** - Realistic fuel-to-heat conversion with cooling
- ✅ **Buoyancy Effects** - Thermal buoyancy driving fire upward
- ✅ **Pressure Projection** - Incompressible fluid simulation
- ✅ **Blackbody Radiation** - Temperature-based color mapping
- ✅ **Interactive Controls** - Real-time parameter adjustment
- ✅ **Debug Modes** - Visualize individual physical fields

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
│   ├── main.js                    # Main application entry point
│   ├── utility.js                 # WebGL utility functions
│   └── shaders/
│       ├── baseVertexShader.glsl  # Base vertex shader (full-screen quad)
│       ├── advectionShader.glsl   # Advection shader (Semi-Lagrangian method)
│       ├── combustionShader.glsl  # Combustion shader (fuel → temperature)
│       ├── buoyancyShader.glsl    # Buoyancy shader (temperature → velocity)
│       ├── divergenceShader.glsl  # Divergence calculation
│       ├── pressureIterationShader.glsl  # Pressure solver (Jacobi iteration)
│       ├── projectionShader.glsl  # Pressure projection
│       ├── vorticityConfinementShader.glsl  # Vorticity confinement
│       ├── displayFireShader.glsl  # Final fire rendering
│       └── ... (other shaders)
├── index.html                     # HTML entry point
├── package.json                   # Project dependencies
└── vite.config.js                # Vite configuration
```

## Physics Fields and Their Relationships

This fire simulation implements a complete fluid dynamics system with multiple interacting physical fields. Understanding these relationships is crucial for modifying and extending the simulation.

### Core Physical Fields

1. **Velocity Field** (`velocity`)
   - Type: RG format (two channels)
   - Stores: (vx, vy) velocity vector per pixel
   - Role: Drives movement of all other fields

2. **Temperature Field** (`temperature`)
   - Type: Single-channel float
   - Stores: Temperature value per pixel
   - Role: Generates buoyancy, affects fire color

3. **Fuel Field** (`fuel`)
   - Type: Single-channel float
   - Stores: Fuel amount per pixel
   - Role: Burns to produce temperature

4. **Density Field** (`density`)
   - Type: RGBA format (four channels)
   - Stores: Color/smoke information
   - Role: Visual effects (color and transparency)

5. **Pressure Field** (`pressure`)
   - Type: Single-channel float
   - Stores: Pressure value
   - Role: Corrects velocity field to satisfy incompressibility

### Field Interaction Diagram

```
┌─────────────┐
│  Fuel Field │ ──┐
│   (Fuel)    │   │
└─────────────┘   │
                  │ Combustion
┌─────────────┐   │
│ Temperature │ ◄─┘
│   Field     │   │
└─────────────┘   │
      │           │
      │ Buoyancy  │
      ▼           │
┌─────────────┐   │
│  Velocity   │   │
│   Field     │   │
└─────────────┘   │
      │           │
      │ Advection │
      ├───────────┘
      │
      ├──► Density Field - Color/smoke
      ├──► Temperature Field - Carried along
      ├──► Fuel Field - Carried along
      │
      ▼
┌─────────────┐
│  Pressure   │ ◄── Computed from velocity (divergence)
│   Field     │
└─────────────┘
      │
      │ Pressure Projection
      ▼
┌─────────────┐
│  Velocity   │ ◄── Corrected (divergence-free)
│   Field     │
└─────────────┘
```

### Detailed Field Interactions

#### 1. Fuel Field → Temperature Field (Combustion)

**Relationship Type:** Unidirectional conversion

**Process:**
- Fuel converts to heat when reaching burn temperature
- Formula: `temp = max(temp, fuel * burnTemperature)`
- Temperature is at least equal to fuel amount × burn temperature

**Code Location:** `combustionShader.glsl`

```glsl
float fuelTemperature (float fuel) {
  return fuel * burnTemperature;
}
temp = max(temp, fuelTemperature(fuel));
```

**Characteristics:**
- Fuel is the "energy source" for temperature
- More fuel produces higher temperature
- Fuel gradually depletes through dissipation during combustion

#### 2. Temperature Field → Velocity Field (Buoyancy)

**Relationship Type:** Unidirectional influence

**Process:**
- Hot air has lower density, experiences upward buoyancy
- Higher temperature = greater buoyancy
- Buoyancy impulse: `impulse = dt * buoyancy * temperature * (0, 1)`
- New velocity = old velocity + buoyancy impulse

**Code Location:** `buoyancyShader.glsl`

```glsl
vec2 impulse = dt * buoyancy * dTemp * vec2(0.0, 1.0);
gl_FragColor = vec4(vel + impulse, 0.0, 1.0);
```

**Characteristics:**
- This is the main reason fire rises
- Higher temperature = faster upward movement
- Buoyancy direction is always upward (positive Y)

#### 3. Velocity Field → All Scalar Fields (Advection)

**Relationship Type:** Unidirectional influence

**Process:**
- All scalar fields (density, temperature, fuel) move with the velocity field
- Uses Semi-Lagrangian advection method
- Formula: `new_value = old_value at (position - velocity * time)`

**Code Location:** `advectionShader.glsl`

```glsl
vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
gl_FragColor = dissipation * texture2D(uSource, coord);
```

**Affected Fields:**
1. **Density Field**: Color/smoke moves with fluid
2. **Temperature Field**: Heat moves with fluid
3. **Fuel Field**: Fuel moves with fluid
4. **Noise Field**: Turbulence moves with fluid

**Characteristics:**
- Velocity field is the "transport mechanism" carrying all matter
- Different fields have different dissipation rates
- Density field uses higher resolution for better visual quality

#### 4. Velocity Field ↔ Pressure Field (Pressure Projection)

**Relationship Type:** Bidirectional influence

**Process:**

**4.1 Velocity Field → Pressure Field**
- Calculate velocity field divergence: `divergence = ∂u/∂x + ∂v/∂y`
- Solve Poisson equation: `∇²p = divergence`
- Use Jacobi iteration to solve pressure field

**4.2 Pressure Field → Velocity Field**
- Subtract pressure gradient from velocity: `u_new = u_old - ∇p`
- Make velocity field divergence-free: `div(u) = 0`

**Code Locations:**
- `divergenceShader.glsl` - Calculate divergence
- `pressureIterationShader.glsl` - Solve pressure
- `projectionShader.glsl` - Pressure projection

**Characteristics:**
- Pressure field is a temporary computational field
- Used to correct velocity field, simulating incompressible fluid
- Pressure projection is a core step in fluid simulation

#### 5. Temperature + Fuel + Density → Final Rendering

**Relationship Type:** Combined rendering

**Process:**
- **Temperature Field**: Determines fire color (blackbody radiation)
- **Fuel Field**: Determines fire visibility/brightness
- **Density Field**: Provides color and smoke effects

**Code Location:** `displayFireShader.glsl`

```glsl
float temp = texture2D(uTemperature, vUv).x;
float fuel = texture2D(uFuel, vUv).x;
vec4 density = texture2D(uDensity, vUv);

float visibility = (exp(10.*fuel)-exp(-10.*fuel))/(exp(10.*fuel)+exp(-10.*fuel));
vec3 color = blackbody(temp);
gl_FragColor = vec4(visibility * color, 1.0);
```

**Characteristics:**
- Temperature determines color (high temp = bright yellow/white, low temp = dark red)
- Fuel determines brightness (more fuel = brighter flame)
- Density provides additional color and smoke effects

### Per-Frame Update Order

The simulation updates fields in the following order each frame:

```
1. Particles → Fuel Field (add fuel)
   ↓
2. Fuel Field + Temperature Field → Temperature Field (combustion & cooling)
   ↓
3. Velocity Field → Velocity Field (self-advection)
   ↓
4. Velocity Field → Velocity Field (vorticity confinement)
   ↓
5. Temperature Field → Velocity Field (buoyancy)
   ↓
6. Velocity Field → Pressure Field → Velocity Field (pressure projection)
   ↓
7. Velocity Field → Density Field (advection)
   ↓
8. Velocity Field → Temperature Field (advection)
   ↓
9. Velocity Field → Fuel Field (advection)
   ↓
10. Noise Field update
```

### Field Lifecycles

**Fuel Field**
- **Generated by**: Particle emitters, user interaction (splat)
- **Consumed by**: Combustion (converted to temperature)
- **Decay**: Per-frame dissipation (FUEL_DISSIPATION = 0.92)

**Temperature Field**
- **Generated by**: Fuel combustion
- **Decay**: Natural cooling (fourth-power model)
- **Movement**: Advected by velocity field

**Velocity Field**
- **Generated by**: Buoyancy, user interaction
- **Decay**: Per-frame dissipation (VELOCITY_DISSIPATION = 0.98)
- **Correction**: Pressure projection makes it divergence-free

**Density Field**
- **Generated by**: User interaction (splat)
- **Decay**: Per-frame dissipation (DENSITY_DISSIPATION = 0.99)
- **Movement**: Advected by velocity field

**Pressure Field**
- **Generated by**: Computed from velocity field divergence
- **Purpose**: Corrects velocity field
- **Decay**: Per-frame dissipation (PRESSURE_DISSIPATION = 0.8)

### Key Parameters

**BUOYANCY** (Buoyancy Coefficient)
- **Affects**: Temperature → Velocity conversion strength
- **Higher value**: Fire rises faster

**BURN_TEMPERATURE** (Burn Temperature)
- **Affects**: Fuel → Temperature conversion
- **Higher value**: More fuel needed to produce same temperature

**COOLING** (Cooling Coefficient)
- **Affects**: Natural temperature decrease rate
- **Higher value**: Temperature decreases faster

**VELOCITY_DISSIPATION** (Velocity Dissipation)
- **Affects**: Velocity field decay
- **Lower value**: Velocity decays faster (simulates viscosity)

**FUEL_DISSIPATION** (Fuel Dissipation)
- **Affects**: Fuel field decay
- **Lower value**: Fuel disappears faster

**DENSITY_DISSIPATION** (Density Dissipation)
- **Affects**: Color/smoke decay
- **Lower value**: Color disappears faster

### Physical Models

This fire simulation system is based on the following physical principles:

1. **Navier-Stokes Equations**: Describe fluid motion
2. **Incompressibility Condition**: div(u) = 0 (achieved through pressure projection)
3. **Buoyancy Principle**: Hot air rises (Archimedes' principle)
4. **Blackbody Radiation**: Temperature determines color (Stefan-Boltzmann law)
5. **Combustion Reaction**: Fuel → Heat
6. **Heat Conduction**: Natural temperature cooling

All fields are interconnected through the **advection** process, forming a complete physical system.

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

### Utility Functions

The `utility.js` module provides reusable WebGL functions:

- `compileShader(gl, type, source)` - Compile vertex or fragment shaders
- `createProgram(gl, vertexShader, fragmentShader)` - Link shaders into a program
- `createQuadBuffer(gl)` - Create a full-screen quad for rendering

## Controls

### Interactive Controls
- **Mouse/Touch**: Click and drag to add fuel, velocity, and color to the simulation
- **Spacebar**: Cycle through debug display modes
- **Panel Controls**: Adjust simulation parameters in real-time

### Debug Modes
Press Spacebar or use the panel dropdown to switch between:
- **Normal**: Full fire rendering with particles
- **DebugFire**: Visualize fuel and temperature
- **DebugTemperature**: Temperature field only
- **DebugFuel**: Fuel field only
- **DebugPressure**: Pressure field only
- **DebugDensity**: Density (color) field only
- **DebugNoise**: Noise field only

## License

See [LICENSE](LICENSE) file for details.

## Acknowledgments

This project was created as part of CSCI 580 coursework.

