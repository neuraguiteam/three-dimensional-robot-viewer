
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

    // Parse joints and links
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

    // Create root node for the robot
    const robotRoot = new BABYLON.TransformNode("robotRoot", scene);
    robotRoot.rotation = new BABYLON.Vector3(0, 0, Math.PI/2); // +Z up orientation

    // Create transform nodes for links and store them in a map
    const linkNodes = new Map<string, BABYLON.TransformNode>();
    
    // First pass: Create all link nodes
    for (const link of links) {
      const linkNode = new BABYLON.TransformNode(link.name, scene);
      linkNodes.set(link.name, linkNode);
    }

    // Second pass: Process joints and establish parent-child relationships
    for (const joint of joints) {
      const parentNode = linkNodes.get(joint.parent);
      const childNode = linkNodes.get(joint.child);

      if (parentNode && childNode) {
        // Create a joint transform node
        const jointNode = new BABYLON.TransformNode(`joint_${joint.name}`, scene);
        jointNode.parent = parentNode;

        // Apply joint origin transformation to the joint node
        if (joint.origin) {
          // Position
          if (joint.origin.xyz) {
            const [x, y, z] = joint.origin.xyz.split(' ').map(Number);
            jointNode.position = new BABYLON.Vector3(x, y, z);
          }

          // Rotation (RPY - Roll, Pitch, Yaw)
          if (joint.origin.rpy) {
            const [roll, pitch, yaw] = joint.origin.rpy.split(' ').map(Number);
            // Convert RPY to Euler angles in the correct order
            const quaternion = BABYLON.Quaternion.RotationYawPitchRoll(yaw, pitch, roll);
            jointNode.rotationQuaternion = quaternion;
          }
        }

        // Parent the child link to the joint transform
        childNode.parent = jointNode;
      }
    }

    // Third pass: Load meshes and attach them to their respective link nodes
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

    // Parent the root link (Body) to the robot root
    const bodyNode = linkNodes.get('Body');
    if (bodyNode) {
      bodyNode.parent = robotRoot;
    }

  } catch (error) {
    console.error('Error loading URDF file:', error);
    throw error;
  }
}
