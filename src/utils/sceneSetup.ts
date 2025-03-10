
import * as BABYLON from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';
import { SceneConfig } from '../types/sceneTypes';

export const setupScene = (
  canvas: HTMLCanvasElement,
  config: SceneConfig = {}
): BABYLON.Scene => {
  const scene = new BABYLON.Scene(new BABYLON.Engine(canvas));
  
  // Set clear color
  scene.clearColor = config.clearColor || new BABYLON.Color4(0.05, 0.05, 0.05, 1);

  // Setup camera
  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    config.cameraConfig?.alpha || 0,
    config.cameraConfig?.beta || Math.PI / 3,
    config.cameraConfig?.radius || 10,
    config.cameraConfig?.target || BABYLON.Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 50;
  camera.lowerRadiusLimit = config.cameraConfig?.lowerRadiusLimit || 2;
  camera.upperRadiusLimit = config.cameraConfig?.upperRadiusLimit || 20;

  // Setup lighting
  const light = new BABYLON.HemisphericLight(
    "light",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  light.intensity = 0.7;

  // Setup grid
  if (config.gridConfig !== undefined) {
    const gridSize = config.gridConfig.size || 20;
    const grid = BABYLON.MeshBuilder.CreateGround(
      "grid",
      { 
        width: gridSize, 
        height: gridSize, 
        subdivisions: config.gridConfig.subdivisions || 20 
      },
      scene
    );
    
    const gridMaterial = new GridMaterial("gridMaterial", scene);
    gridMaterial.majorUnitFrequency = config.gridConfig.majorUnitFrequency || 5;
    gridMaterial.minorUnitVisibility = config.gridConfig.minorUnitVisibility || 0.3;
    gridMaterial.gridRatio = 1;
    gridMaterial.backFaceCulling = false;
    gridMaterial.mainColor = config.gridConfig.mainColor || new BABYLON.Color3(0.2, 0.2, 0.2);
    gridMaterial.lineColor = config.gridConfig.lineColor || new BABYLON.Color3(0.4, 0.4, 0.4);
    grid.material = gridMaterial;
  }

  return scene;
};
