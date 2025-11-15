precision highp float;

uniform float uTime;
uniform vec2 uResolution;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    
    // TODO: palceholder for fire effect
    vec3 color = mix(vec3(1.0, 0.2, 0.0), vec3(0.1, 0.0, 0.0), uv.y);

    gl_FragColor = vec4(color, 1.0);
}
