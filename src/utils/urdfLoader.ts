
import * as BABYLON from '@babylonjs/core';
import { parseString } from 'xml2js';

interface JointInfo {
  name: string;
  type: string;
  origin?: {
    xyz?: string;
    rpy?: string;
  };
  parent: string;
  child: string;
}

interface LinkInfo {
  name: string;
  visual?: {
    origin?: {
      xyz?: string;
      rpy?: string;
    };
    geometry?: {
      mesh?: {
        filename?: string;
      };
    };
  };
}

export async function loadURDFRobot(
  scene: BABYLON.Scene,
  urdfPath: string,
  baseUrl: string
): Promise<void> {
  try {
    const response = await fetch(urdfPath);
    const urdfContent = await response.text();

    // Use parseString with a Promise wrapper instead of util.promisify
    const result = await new Promise((resolve, reject) => {
      parseString(urdfContent, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const robot = result.robot;
    const links: LinkInfo[] = robot.link;
    const joints: JointInfo[] = robot.joint;

    // Create a root node for the robot
    const robotRoot = new BABYLON.TransformNode("robotRoot", scene);
    robotRoot.rotation = new BABYLON.Vector3(0, 0, Math.PI/2); // +Z up orientation

    // Load and position meshes based on URDF
    for (const link of links) {
      if (link.visual && link.visual[0].geometry && link.visual[0].geometry[0].mesh) {
        const meshPath = link.visual[0].geometry[0].mesh[0].filename[0];
        const meshUrl = `${baseUrl}/${meshPath}`;

        try {
          const meshes = await BABYLON.SceneLoader.ImportMeshAsync("", "", meshUrl, scene);
          const mesh = meshes.meshes[0];
          mesh.parent = robotRoot;

          // Apply transformations from URDF if available
          if (link.visual[0].origin) {
            const origin = link.visual[0].origin[0];
            if (origin.xyz) {
              const [x, y, z] = origin.xyz.split(' ').map(Number);
              mesh.position = new BABYLON.Vector3(x, y, z);
            }
            if (origin.rpy) {
              const [rx, ry, rz] = origin.rpy.split(' ').map(Number);
              mesh.rotation = new BABYLON.Vector3(rx, ry, rz);
            }
          }
        } catch (error) {
          console.error(`Error loading mesh for link ${link.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error loading URDF file:', error);
    throw error;
  }
}
