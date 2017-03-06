'use strict';

var vertexShader = 'void main()\t{\n\t\t\tgl_Position = vec4( position, 1.0 );\n\t\t}';

var fragmentShader = 'uniform float iGlobalTime;\n\tuniform vec2 iResolution;\n\tuniform vec4 iMouse;\n\t\nconst int NUM_STEPS = 8;\nconst float PI\t \t= 3.1415;\nconst float EPSILON\t= 1e-3;\nfloat EPSILON_NRM\t= 0.1 / iResolution.x;\n\n// sea\nconst int ITER_GEOMETRY = 3;\nconst int ITER_FRAGMENT = 5;\nconst float SEA_HEIGHT = 0.6;\nconst float SEA_CHOPPY = 4.0;\nconst float SEA_SPEED = 0.8;\nconst float SEA_FREQ = 0.16;\nconst vec3 SEA_BASE = vec3(0.1,0.19,0.22);\nconst vec3 SEA_WATER_COLOR = vec3(0.8,0.9,0.6);\nfloat SEA_TIME = iGlobalTime * SEA_SPEED;\nmat2 octave_m = mat2(1.6,1.2,-1.2,1.6);\n\n// math\nmat3 fromEuler(vec3 ang) {\n\tvec2 a1 = vec2(sin(ang.x),cos(ang.x));\n    vec2 a2 = vec2(sin(ang.y),cos(ang.y));\n    vec2 a3 = vec2(sin(ang.z),cos(ang.z));\n    mat3 m;\n    m[0] = vec3(a1.y*a3.y+a1.x*a2.x*a3.x,a1.y*a2.x*a3.x+a3.y*a1.x,-a2.y*a3.x);\n\tm[1] = vec3(-a2.y*a1.x,a1.y*a2.y,a2.x);\n\tm[2] = vec3(a3.y*a1.x*a2.x+a1.y*a3.x,a1.x*a3.x-a1.y*a3.y*a2.x,a2.y*a3.y);\n\treturn m;\n}\nfloat hash( vec2 p ) {\n\tfloat h = dot(p,vec2(127.1,311.7));\t\n    return fract(sin(h)*43758.5453123);\n}\nfloat noise( in vec2 p ) {\n    vec2 i = floor( p );\n    vec2 f = fract( p );\t\n\tvec2 u = f*f*(3.0-2.0*f);\n    return -1.0+2.0*mix( mix( hash( i + vec2(0.0,0.0) ), \n                     hash( i + vec2(1.0,0.0) ), u.x),\n                mix( hash( i + vec2(0.0,1.0) ), \n                     hash( i + vec2(1.0,1.0) ), u.x), u.y);\n}\n\n// lighting\nfloat diffuse(vec3 n,vec3 l,float p) {\n    return pow(dot(n,l) * 0.4 + 0.6,p);\n}\nfloat specular(vec3 n,vec3 l,vec3 e,float s) {    \n    float nrm = (s + 8.0) / (3.1415 * 8.0);\n    return pow(max(dot(reflect(e,n),l),0.0),s) * nrm;\n}\n\n// sky\nvec3 getSkyColor(vec3 e) {\n    e.y = max(e.y,0.0);\n    vec3 ret;\n    ret.x = pow(1.0-e.y,2.0);\n    ret.y = 1.0-e.y;\n    ret.z = 0.6+(1.0-e.y)*0.4;\n    return ret;\n}\n\n// sea\nfloat sea_octave(vec2 uv, float choppy) {\n    uv += noise(uv);        \n    vec2 wv = 1.0-abs(sin(uv));\n    vec2 swv = abs(cos(uv));    \n    wv = mix(wv,swv,wv);\n    return pow(1.0-pow(wv.x * wv.y,0.65),choppy);\n}\n\nfloat map(vec3 p) {\n    float freq = SEA_FREQ;\n    float amp = SEA_HEIGHT;\n    float choppy = SEA_CHOPPY;\n    vec2 uv = p.xz; uv.x *= 0.75;\n    \n    float d, h = 0.0;    \n    for(int i = 0; i < ITER_GEOMETRY; i++) {        \n    \td = sea_octave((uv+SEA_TIME)*freq,choppy);\n    \td += sea_octave((uv-SEA_TIME)*freq,choppy);\n        h += d * amp;        \n    \tuv *= octave_m; freq *= 1.9; amp *= 0.22;\n        choppy = mix(choppy,1.0,0.2);\n    }\n    return p.y - h;\n}\n\nfloat map_detailed(vec3 p) {\n    float freq = SEA_FREQ;\n    float amp = SEA_HEIGHT;\n    float choppy = SEA_CHOPPY;\n    vec2 uv = p.xz; uv.x *= 0.75;\n    \n    float d, h = 0.0;    \n    for(int i = 0; i < ITER_FRAGMENT; i++) {        \n    \td = sea_octave((uv+SEA_TIME)*freq,choppy);\n    \td += sea_octave((uv-SEA_TIME)*freq,choppy);\n        h += d * amp;        \n    \tuv *= octave_m; freq *= 1.9; amp *= 0.22;\n        choppy = mix(choppy,1.0,0.2);\n    }\n    return p.y - h;\n}\n\nvec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist) {  \n    float fresnel = 1.0 - max(dot(n,-eye),0.0);\n    fresnel = pow(fresnel,3.0) * 0.65;\n        \n    vec3 reflected = getSkyColor(reflect(eye,n));    \n    vec3 refracted = SEA_BASE + diffuse(n,l,80.0) * SEA_WATER_COLOR * 0.12; \n    \n    vec3 color = mix(refracted,reflected,fresnel);\n    \n    float atten = max(1.0 - dot(dist,dist) * 0.001, 0.0);\n    color += SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.18 * atten;\n    \n    color += vec3(specular(n,l,eye,60.0));\n    \n    return color;\n}\n\n// tracing\nvec3 getNormal(vec3 p, float eps) {\n    vec3 n;\n    n.y = map_detailed(p);    \n    n.x = map_detailed(vec3(p.x+eps,p.y,p.z)) - n.y;\n    n.z = map_detailed(vec3(p.x,p.y,p.z+eps)) - n.y;\n    n.y = eps;\n    return normalize(n);\n}\n\nfloat heightMapTracing(vec3 ori, vec3 dir, out vec3 p) {  \n    float tm = 0.0;\n    float tx = 1000.0;    \n    float hx = map(ori + dir * tx);\n    if(hx > 0.0) return tx;   \n    float hm = map(ori + dir * tm);    \n    float tmid = 0.0;\n    for(int i = 0; i < NUM_STEPS; i++) {\n        tmid = mix(tm,tx, hm/(hm-hx));                   \n        p = ori + dir * tmid;                   \n    \tfloat hmid = map(p);\n\t\tif(hmid < 0.0) {\n        \ttx = tmid;\n            hx = hmid;\n        } else {\n            tm = tmid;\n            hm = hmid;\n        }\n    }\n    return tmid;\n}\n\nvoid main() {\n\tvec2 uv = gl_FragCoord.xy / iResolution.xy;\n    uv = uv * 2.0 - 1.0;\n    uv.x *= iResolution.x / iResolution.y;    \n    float time = iGlobalTime * 0.3 + iMouse.x*0.01;\n        \n    // ray\n    vec3 ang = vec3(sin(time*3.0)*0.1,sin(time)*0.2+0.3,time);    \n    vec3 ori = vec3(0.0,3.5,time*5.0);\n    vec3 dir = normalize(vec3(uv.xy,-2.0)); dir.z += length(uv) * 0.15;\n    dir = normalize(dir) * fromEuler(ang);\n    \n    // tracing\n    vec3 p;\n    heightMapTracing(ori,dir,p);\n    vec3 dist = p - ori;\n    vec3 n = getNormal(p, dot(dist,dist) * EPSILON_NRM);\n    vec3 light = normalize(vec3(0.0,1.0,0.8)); \n             \n    // color\n    vec3 color = mix(\n        getSkyColor(dir),\n        getSeaColor(p,n,light,dir,dist),\n    \tpow(smoothstep(0.0,-0.05,dir.y),0.3));\n        \n    // post\n\tgl_FragColor = vec4(pow(color,vec3(0.75)), 1.0);\n\t}';

// init camera, scene, renderer
var scene, camera, renderer;
/* global THREE */
scene = new THREE.Scene();
var fov = 75,
    aspect = window.innerWidth / window.innerHeight;
camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
camera.position.z = 100;
camera.lookAt(scene.position);
renderer = new THREE.WebGLRenderer();
renderer.setClearColor(0xc4c4c4);
renderer.setSize(window.innerWidth, window.innerHeight);
//document.body.appendChild(renderer.domElement);
document.getElementById("shader-background").appendChild(renderer.domElement);

var clock = new THREE.Clock();

var tuniform = {
    iGlobalTime: {
        type: 'f',
        value: 0.1
    },
    iResolution: {
        type: 'v2',
        value: new THREE.Vector2()
    },
    iMouse: {
        type: 'v4',
        value: new THREE.Vector2()
    }
};

// resize canvas function
/*
window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
*/
tuniform.iResolution.value.x = window.innerWidth;
tuniform.iResolution.value.y = window.innerHeight;
// Create Plane
var material = new THREE.ShaderMaterial({
    uniforms: tuniform,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader
});
var mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(window.innerWidth, window.innerHeight, 40), material);
scene.add(mesh);

// draw animation
function render(time) {
    tuniform.iGlobalTime.value += clock.getDelta();
    requestAnimationFrame(render);
    renderer.render(scene, camera);
}
//render();

// Only render when element is visible
/*global $ */
$(window).scroll(function() {
    var top_of_element = $("canvas").offset().top;
    var bottom_of_element = $("canvas").offset().top + $("canvas").outerHeight();
    var bottom_of_screen = $(window).scrollTop() + $(window).height();

    if((bottom_of_screen > top_of_element) && (bottom_of_screen < bottom_of_element)){
        // The element is visible, do something
        render();
    }
    else {
        // The element is not visible, do something else
    }
});