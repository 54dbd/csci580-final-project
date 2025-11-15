precision highp float;

uniform vec3 uColor;
uniform float uAlpha;

void main() {
    // Create soft circular point using gl_PointCoord
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);
    float mask = smoothstep(0.5, 0.45, dist);
    gl_FragColor = vec4(uColor, uAlpha * mask);
}
