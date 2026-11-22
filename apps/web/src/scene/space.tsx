import { Canvas } from "@react-three/fiber";
import { type ReactNode, useState } from "react";
import { NeutralToneMapping } from "three";

import { Daylight } from "./gym/daylight";
import { DustMotes } from "./gym/dust-motes";
import { HeavyBags } from "./gym/heavy-bags";
import { LATE_AFTERNOON } from "./gym/late-afternoon";
import { VIEW } from "./gym/measurements";
import { Ring } from "./gym/ring";
import { Room } from "./gym/room";
import { WallClock } from "./gym/wall-clock";
import { OrbitRig } from "./orbit-rig";

export interface SpaceProps {
  readonly reducedMotion: boolean;
  readonly children: ReactNode;
}

// R3F 기본값 ACES 는 노출에 1/0.6 을 곱하고 밝은 색의 채도를 뺍니다. Neutral 은 밝지 않은 색을 그대로 내서 도형이 제 색으로 보입니다.
const RENDERER = {
  toneMapping: NeutralToneMapping,
  toneMappingExposure: LATE_AFTERNOON.exposure,
};

const SCENE = { environmentIntensity: LATE_AFTERNOON.environmentIntensity };

const CAMERA = { fov: VIEW.fov, position: VIEW.home };

/**
 * 도형이 놓이는 무대, 늦은 오후의 오래된 복싱 체육관입니다. 캔버스와 색 처리, 카메라가 갈 수 있는 범위, 빛, 세트를 여기서 정합니다.
 * - children 은 원점의 반지름 GYM.subject.radius 구 안에 놓입니다. 세트는 그 자리를 비워 두고, 그 안은 도형 조명이 밝힙니다.
 * - children 의 메시는 receiveShadow 를 켭니다. 그래야 창 사이 벽 그림자에 들어 따뜻한 햇빛에 색이 바래지 않습니다.
 * - 포인터 이벤트 핸들러를 달지 않습니다. 누를 수 있는 것은 children 이 정합니다. 누름으로 카메라가 돌지 않게 하려면 pointerdown 에서 nativeEvent.stopPropagation() 을 부릅니다.
 * - 세트는 VIEW 가 허락하는 모든 카메라 위치에서 빈 곳 없이 보여야 합니다.
 * - 소품을 더하려면 gym/heavy-bags.tsx(그림 텍스처가 있으면 gym/wall-clock.tsx)를 본떠 gym/ 에 파일을 만들고 아래에 한 줄 넣습니다.
 */
export function Space({ reducedMotion, children }: SpaceProps) {
  const [orbitSurface, setOrbitSurface] = useState<HTMLDivElement | null>(null);

  return (
    <div ref={setOrbitSurface} className="h-full w-full">
      <Canvas
        dpr={[1, 2]}
        shadows="percentage"
        gl={RENDERER}
        scene={SCENE}
        camera={CAMERA}
      >
        <Daylight />
        <Room />
        <Ring />
        <HeavyBags />
        <WallClock />
        <DustMotes drifting={!reducedMotion} />
        {orbitSurface ? (
          <OrbitRig
            surface={orbitSurface}
            inertia={!reducedMotion}
            limits={VIEW}
          />
        ) : null}
        {children}
      </Canvas>
    </div>
  );
}
