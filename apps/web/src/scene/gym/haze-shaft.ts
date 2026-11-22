import { extend } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  type ColorRepresentation,
  DoubleSide,
  type IUniform,
  Matrix3,
  Matrix4,
  ShaderMaterial,
  Vector3,
} from "three";

// 인덱스 시그니처가 있는 ShaderMaterial.uniforms 에 넣으려면 interface 가 아니라 type 이어야 합니다.
type ShaftUniforms = {
  readonly color: IUniform<Color>;
  readonly density: IUniform<number>;
  readonly localCamera: IUniform<Vector3>;
  readonly worldScale: IUniform<Matrix3>;
  readonly inside: IUniform<number>;
};

const VERTEX = /* glsl */ `
  varying vec3 vLocal;

  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 color;
  uniform float density;
  uniform vec3 localCamera;
  uniform mat3 worldScale;
  uniform float inside;
  varying vec3 vLocal;

  void main() {
    if ((inside > 0.5) == gl_FrontFacing) discard;
    vec3 dir = normalize(vLocal - localCamera);
    vec3 inv = 1.0 / dir;
    vec3 t0 = (vec3(-0.5) - localCamera) * inv;
    vec3 t1 = (vec3(0.5) - localCamera) * inv;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    float tNear = max(max(max(tmin.x, tmin.y), tmin.z), 0.0);
    float tFar = min(min(tmax.x, tmax.y), tmax.z);
    if (tFar <= tNear) discard;
    vec3 mid = localCamera + dir * (tNear + tFar) * 0.5;
    float len = length(worldScale * (dir * (tFar - tNear)));
    float edge = (1.0 - smoothstep(0.05, 0.5, abs(mid.x))) * (1.0 - smoothstep(0.05, 0.5, abs(mid.y)));
    float along = 1.0 - smoothstep(-0.5, 0.5, mid.z);
    float a = min(1.0 - exp(-density * len * edge * (0.3 + 0.7 * along)), 0.16);
    gl_FragColor = vec4(color * a, 1.0);
  }
`;

class HazeShaft extends ShaderMaterial {
  readonly #shaft: ShaftUniforms;
  readonly #toLocal = new Matrix4();

  constructor(color: ColorRepresentation, density: number) {
    const shaft: ShaftUniforms = {
      color: { value: new Color(color) },
      density: { value: density },
      localCamera: { value: new Vector3() },
      worldScale: { value: new Matrix3() },
      inside: { value: 0 },
    };

    super({
      uniforms: shaft,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      fog: false,
    });
    this.#shaft = shaft;
  }

  override onBeforeRender(
    ...args: Parameters<ShaderMaterial["onBeforeRender"]>
  ): void {
    const [, , camera, , object] = args;
    const local = this.#shaft.localCamera.value;

    this.#toLocal.copy(object.matrixWorld).invert();
    local.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(this.#toLocal);
    this.#shaft.worldScale.value.setFromMatrix4(object.matrixWorld);
    this.#shaft.inside.value =
      Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)) < 0.5
        ? 1
        : 0;
  }
}

/** 단위 상자 메시에 붙이고, 메시의 matrix 로 기둥의 모양을 정합니다. args 는 [color, density] 입니다. */
export const HazeShaftMaterial = extend(HazeShaft);
