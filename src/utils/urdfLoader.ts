
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

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(urdfContent, "text/xml");

    // Parse joints first
    const joints: JointInfo[] = Array.from(xmlDoc.getElementsByTagName('joint')).map(joint => ({
      name: joint.getAttribute('name') || '',
      type: joint.getAttribute('type') || '',
      origin: Array.from(joint.getElementsByTagName('origin')).map(origin => ({
        xyz: origin.getAttribute('xyz') || '0 0 0',
        rpy: origin.getAttribute('rpy') || '0 0 0'
      }))[0],
      parent: joint.getElementsByTagName('parent')[0]?.getAttribute('link') || '',
      child: joint.getElementsByTagName('child')[0]?.getAttribute('link') || ''
    }));

    // Parse links
    const links: LinkInfo[] = Array.from(xmlDoc.getElementsByTagName('link')).map(link => ({
      name: link.getAttribute('name') || '',
      visual: Array.from(link.getElementsByTagName('visual')).map(visual => ({
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

    // Create a map to store mesh nodes by link name
    const linkNodes = new Map<string, BABYLON.TransformNode>();

    // Create transform nodes for all links
    for (const link of links) {
      const linkNode = new BABYLON.TransformNode(link.name, scene);
      linkNodes.set(link.name, linkNode);
    }

    // Process joints to establish parent-child relationships and transformations
    for (const joint of joints) {
      const childNode = linkNodes.get(joint.child);
      const parentNode = linkNodes.get(joint.parent);

      if (childNode && parentNode) {
        childNode.parent = parentNode;

        // Apply joint origin transformation
        if (joint.origin) {
          // Parse position
          const [x, y, z] = joint.origin.xyz?.split(' ').map(Number) || [0, 0, 0];
          childNode.position = new BABYLON.Vector3(x, y, z);

          // Parse rotation (RPY - Roll, Pitch, Yaw)
          const [rx, ry, rz] = joint.origin.rpy?.split(' ').map(Number) || [0, 0, 0];
          childNode.rotation = new BABYLON.Vector3(rx, ry, rz);
        }
      }
    }

    // Load meshes for links
    for (const link of links) {
      if (link.visual && link.visual[0]?.geometry?.mesh?.filename) {
        const rawMeshPath = link.visual[0].geometry.mesh.filename;
        const meshPath = rawMeshPath.replace('../', '');
        const meshUrl = `${baseUrl}/${meshPath}`;
        console.log('Loading mesh:', meshUrl);

        try {
          const meshes = await BABYLON.SceneLoader.ImportMeshAsync("", "", meshUrl, scene);
          const mesh = meshes.meshes[0];
          const linkNode = linkNodes.get(link.name);
          if (linkNode) {
            mesh.parent = linkNode;
          }
        } catch (error) {
          console.error(`Error loading mesh for link ${link.name}:`, error);
        }
      }
    }

    // Parent the root link to the robot root
    const bodyNode = linkNodes.get('Body');
    if (bodyNode) {
      bodyNode.parent = robotRoot;
    }
  } catch (error) {
    console.error('Error loading URDF file:', error);
    throw error;
  }
}
