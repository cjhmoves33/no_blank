import { type BufferGeometry, Vector3 } from "three";

// SphereGeometry 나 LatheGeometry 는 텍스처 이음매와 두 극에서 같은 자리에 정점을 따로 두므로, 그 법선을 평균해 이음매가 보이지 않게 합니다.
export function joinSplitNormals(geometry: BufferGeometry): void {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const sums = new Map<string, Vector3>();
  const keyOf = (i: number) =>
    [positions.getX(i), positions.getY(i), positions.getZ(i)]
      .map((value) => value.toFixed(5))
      .join();

  for (let i = 0; i < positions.count; i++) {
    const sum = sums.get(keyOf(i)) ?? new Vector3();

    sums.set(keyOf(i), sum.add(new Vector3().fromBufferAttribute(normals, i)));
  }

  for (let i = 0; i < positions.count; i++) {
    const joined = sums.get(keyOf(i))?.clone().normalize();

    if (joined) {
      normals.setXYZ(i, joined.x, joined.y, joined.z);
    }
  }
}
