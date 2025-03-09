
import * as BABYLON from '@babylonjs/core';

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
  }[];
}

export async function loadURDFRobot(
  scene: BABYLON.Scene,
  urdfPath: string,
  baseUrl: string
): Promise<void> {
  try {
    const response = await fetch(urdfPath);
    const urdfContent = await response.text();

    // Use browser's built-in XML parser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(urdfContent, "text/xml");

    // Parse links
    const links: LinkInfo[] = Array.from(xmlDoc.getElementsByTagName('link')).map(link => ({
      name: link.getAttribute('name') || '',
      visual: Array.from(link.getElementsByTagName('visual')).map(visual => ({
        origin: Array.from(visual.getElementsByTagName('origin')).map(origin => ({
          xyz: origin.getAttribute('xyz') || '',
          rpy: origin.getAttribute('rpy') || ''
        }))[0],
        geometry: Array.from(visual.getElementsByTagName('geometry')).map(geometry => ({
          mesh: Array.from(geometry.getElementsByTagName('mesh')).map(mesh => ({
            filename: mesh.getAttribute('filename') || ''
          }))[0]
        }))[0]
      }))
    }));

    // Create a root node for the robot
    const robotRoot = new BABYLON.TransformNode("robotRoot", scene);
    robotRoot.rotation = new BABYLON.Vector3(0, 0, Math.PI/2); // +Z up orientation

    // Load and position meshes based on URDF
    for (const link of links) {
      if (link.visual && link.visual[0]?.geometry?.mesh?.filename) {
        // Fix the mesh path by removing the relative path component
        const rawMeshPath = link.visual[0].geometry.mesh.filename;
        const meshPath = rawMeshPath.replace('../', '');
        const meshUrl = `${baseUrl}/${meshPath}`;
        console.log('Loading mesh:', meshUrl);

        try {
          const meshes = await BABYLON.SceneLoader.ImportMeshAsync("", "", meshUrl, scene);
          const mesh = meshes.meshes[0];
          mesh.parent = robotRoot;

          // Apply transformations from URDF if available
          if (link.visual[0].origin) {
            const origin = link.visual[0].origin;
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
