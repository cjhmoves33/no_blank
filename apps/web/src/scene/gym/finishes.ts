import type { MeshStandardMaterialParameters } from "three";

/** 두 파일 이상이 쓰는 마감만 여기에 둡니다. */
export const STEEL = {
  color: "#3a3b3c",
  roughness: 0.5,
  metalness: 0.55,
} as const satisfies MeshStandardMaterialParameters;
