
import * as BABYLON from '@babylonjs/core';
import { BabylonURDFLoader } from './BabylonURDFLoader';

export async function loadURDFRobot(
  scene: BABYLON.Scene,
  urdfPath: string,
  baseUrl: string
): Promise<void> {
  try {
    const loader = new BabylonURDFLoader(scene, {
      parseVisual: true,
      parseCollision: false,
      workingPath: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
      packages: {}
    });

    await loader.loadAsync(urdfPath);
  } catch (error) {
    console.error('Error loading URDF:', error);
    throw error;
  }
}
