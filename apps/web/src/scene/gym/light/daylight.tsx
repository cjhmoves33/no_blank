import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import {
  PMREMGenerator,
  type PointLight,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

import { HazeShaftMaterial } from "./haze-shaft";
import {
  hazeShaftFrames,
  LATE_AFTERNOON,
  shapeLightPosition,
  sunPosition,
  windowFillRotation,
} from "./late-afternoon";

// RectAreaLight 를 받는 재질은 이 표가 있어야 컴파일됩니다. init 은 부를 때마다 표를 새로 만들므로 한 번만 부릅니다.
RectAreaLightUniformsLib.init();

const SHAFTS = hazeShaftFrames();
const SUN_POSITION = sunPosition();
const WINDOW_FILL_ROTATION = windowFillRotation();

// R3F 는 primitive 를 치우지 않습니다. 환경 맵은 렌더러마다 한 번 굽고, 캔버스가 사라질 때 렌더러의 컨텍스트와 함께 사라집니다.
const environments = new WeakMap<WebGLRenderer, Texture>();

function roomEnvironment(gl: WebGLRenderer): Texture {
  const cached = environments.get(gl);

  if (cached) {
    return cached;
  }

  const pmrem = new PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const texture = pmrem.fromScene(room, 0.04).texture;

  room.dispose();
  pmrem.dispose();
  environments.set(gl, texture);

  return texture;
}

export function Daylight() {
  const gl = useThree((state) => state.gl);
  const { background, fog, sky, windowFill, haze } = LATE_AFTERNOON;

  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[fog.color, fog.near, fog.far]} />
      <primitive attach="environment" object={roomEnvironment(gl)} />
      <Sun />
      <rectAreaLight
        args={[
          windowFill.color,
          windowFill.intensity,
          windowFill.width,
          windowFill.height,
        ]}
        position={windowFill.at}
        quaternion={WINDOW_FILL_ROTATION}
      />
      <hemisphereLight args={[sky.color, sky.ground, sky.intensity]} />
      <ShapeLight />
      {SHAFTS.map((frame, index) => (
        <mesh
          key={index}
          matrix={frame}
          matrixAutoUpdate={false}
          frustumCulled={false}
        >
          <boxGeometry />
          <HazeShaftMaterial args={[haze.color, haze.density]} />
        </mesh>
      ))}
    </>
  );
}

function ShapeLight() {
  const light = useRef<PointLight>(null);
  const { color, intensity, reach } = LATE_AFTERNOON.shapeLight;

  useFrame(({ camera }) => {
    light.current?.position.set(...shapeLightPosition(camera.position));
  });

  return (
    <pointLight
      ref={light}
      color={color}
      intensity={intensity}
      distance={reach}
      decay={0}
    />
  );
}

function Sun() {
  const { color, intensity, shadow } = LATE_AFTERNOON.sun;

  return (
    <directionalLight
      castShadow
      color={color}
      intensity={intensity}
      position={SUN_POSITION}
      shadow-mapSize={[shadow.mapSize, shadow.mapSize]}
      shadow-radius={shadow.radius}
      shadow-bias={shadow.bias}
      shadow-normalBias={shadow.normalBias}
      shadow-camera-left={shadow.camera.left}
      shadow-camera-right={shadow.camera.right}
      shadow-camera-top={shadow.camera.top}
      shadow-camera-bottom={shadow.camera.bottom}
      shadow-camera-near={shadow.camera.near}
      shadow-camera-far={shadow.camera.far}
    />
  );
}
