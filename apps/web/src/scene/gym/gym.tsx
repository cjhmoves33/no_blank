import { Canvas } from "@react-three/fiber";
import { type ReactNode, useState } from "react";
import { NeutralToneMapping } from "three";

import { OrbitRig } from "../orbit-rig";
import { Building } from "./building/building";
import { Daylight } from "./light/daylight";
import { DustMotes } from "./light/dust-motes";
import { LATE_AFTERNOON } from "./light/late-afternoon";
import { RING_VIEW } from "./measurements";
import { HeavyBags } from "./props/heavy-bags";
import { WallClock } from "./props/wall-clock";
import { Ring } from "./ring";

export interface GymProps {
  readonly reducedMotion: boolean;
  readonly children: ReactNode;
}

// R3F 기본값 ACES 는 노출에 1/0.6 을 곱하고 밝은 색의 채도를 뺍니다. Neutral 은 밝지 않은 색을 그대로 내서 도형이 제 색으로 보입니다.
const RENDERER = {
  toneMapping: NeutralToneMapping,
  toneMappingExposure: LATE_AFTERNOON.exposure,
};

const SCENE = { environmentIntensity: LATE_AFTERNOON.environmentIntensity };

// 카메라는 로프에서 15 cm 까지 다가가므로 near 면을 R3F 기본값(0.1)보다 앞에 둡니다.
// far 는 near 와의 비율(1:10000)을 지켜, 벽 앞 2 cm 에 칠한 띠가 벽과 깊이를 다투지 않게 합니다.
const CAMERA = {
  fov: RING_VIEW.fov,
  position: RING_VIEW.home,
  near: 0.05,
  far: 500,
};

/**
 * 늦은 오후의 오래된 복싱 체육관입니다. 캔버스와 색 처리, 링 시점, 빛, 건물, 링, 소품을 여기서 정합니다.
 * - children 은 원점의 반지름 GYM.shape.radius 구 안에 놓입니다. 건물과 소품은 그 자리를 비워 두고, 그 안은 도형을 비추는 빛이 밝힙니다.
 * - children 의 메시는 receiveShadow 를 켭니다. 그래야 창 사이 벽 그림자에 들어 따뜻한 햇빛에 색이 바래지 않습니다.
 * - 포인터 이벤트 핸들러를 달지 않습니다. 누를 수 있는 것은 children 이 정합니다. 누름으로 카메라가 돌지 않게 하려면 pointerdown 에서 nativeEvent.stopPropagation() 을 부릅니다.
 * - 체육관은 RING_VIEW 가 허락하는 모든 카메라 위치에서 빈 곳 없이 보여야 합니다.
 * - 소품을 더하려면 props/heavy-bags.tsx(그림 텍스처가 있으면 props/wall-clock.tsx)를 본떠 props/ 에 파일을 만들고 아래에 한 줄 넣습니다.
 */
export function Gym({ reducedMotion, children }: GymProps) {
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
        <Building />
        <Ring />
        <HeavyBags />
        <WallClock />
        <DustMotes drifting={!reducedMotion} />
        {orbitSurface ? (
          <OrbitRig
            surface={orbitSurface}
            inertia={!reducedMotion}
            limits={RING_VIEW}
          />
        ) : null}
        {children}
      </Canvas>
    </div>
  );
}
