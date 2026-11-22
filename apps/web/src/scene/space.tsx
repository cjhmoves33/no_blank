/**
 * 도형을 둘러싼 공간의 모습입니다. 조명, 배경, 안개, 바닥 같은 보이는 것만 둡니다.
 * - 도형을 비추는 빛은 여기서만 정합니다.
 * - 포인터 이벤트 핸들러를 달지 않습니다. 누를 수 있는 것은 HomeScene 이 정합니다.
 * - 원점의 도형(반지름 1)을 가리지 않습니다.
 * - 배경을 정하지 않으면 페이지 배경이 비쳐 보입니다.
 */
export function Space() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#c7d2fe", 0.8]} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <directionalLight
        position={[-4, -2, -3]}
        intensity={0.6}
        color="#a5b4fc"
      />
    </>
  );
}
