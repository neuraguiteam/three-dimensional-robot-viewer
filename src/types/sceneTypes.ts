
import * as BABYLON from '@babylonjs/core';

export interface SceneConfig {
  clearColor?: BABYLON.Color4;
  cameraConfig?: {
    alpha?: number;
    beta?: number;
    radius?: number;
    target?: BABYLON.Vector3;
    lowerRadiusLimit?: number;
    upperRadiusLimit?: number;
  };
  gridConfig?: {
    size?: number;
    subdivisions?: number;
    majorUnitFrequency?: number;
    minorUnitVisibility?: number;
    mainColor?: BABYLON.Color3;
    lineColor?: BABYLON.Color3;
  };
}
