precision highp float;

attribute vec2 aPos;
uniform vec2 uResolution;

void main() {
    // Convert from pixel space to clip space
    vec2 clip = (aPos / uResolution) * 2.0 - 1.0;
    // Flip Y because canvas Y is top-left
    clip.y *= -1.0;
    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = 16.0; // default size, can be overridden per-particle in future
}
