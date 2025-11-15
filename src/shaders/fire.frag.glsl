precision highp float;

uniform float uTime;
uniform vec2 uResolution;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    
    // Basic fire shader implementation
    // Bottm: Orange，Top: Red
    vec3 color = mix(
        vec3(1.0, 0.5, 0.0),  // Orange
        vec3(0.1, 0.0, 0.0),  // Dark red
        uv.y
    );
    
    gl_FragColor = vec4(color, 1.0);
}
