import type { MeshStandardMaterialParameters } from "three";

export const STEEL = {
  color: "#3a3b3c",
  roughness: 0.5,
  metalness: 0.55,
} as const satisfies MeshStandardMaterialParameters;
