
import * as BABYLON from '@babylonjs/core';
import { URDFLoader } from './URDFLoader';

export async function loadURDFRobot(
  scene: BABYLON.Scene,
  urdfPath: string,
  baseUrl: string
): Promise<void> {
  try {
    const loader = new URDFLoader(scene, {
      parseVisual: true,
      parseCollision: false,
      workingPath: baseUrl,
      packages: {}
    });

    await loader.loadAsync(urdfPath);
  } catch (error) {
    console.error('Error loading URDF:', error);
    throw error;
  }
}
