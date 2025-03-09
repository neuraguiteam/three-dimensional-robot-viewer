
import * as BABYLON from '@babylonjs/core';
import { parseURDF } from './urdfParser';
import { URDFLink, URDFJoint } from './urdfTypes';

function rpyToQuaternion(roll: number, pitch: number, yaw: number): BABYLON.Quaternion {
  return BABYLON.Quaternion.RotationYawPitchRoll(yaw, pitch, roll);
}

export async function loadURDFRobot(
  scene: BABYLON.Scene,
  urdfPath: string,
  baseUrl: string
): Promise<void> {
  try {
    const response = await fetch(urdfPath);
    const urdfContent = await response.text();
    const { links, joints } = await parseURDF(urdfContent);

    // Create a root node for the robot
    const robotRoot = new BABYLON.TransformNode("robotRoot", scene);
    const linkMap: Record<string, BABYLON.TransformNode> = {};

    // First pass: Create all link nodes
    for (const link of links) {
      const linkNode = new BABYLON.TransformNode(link.name, scene);
      linkMap[link.name] = linkNode;
    }

    // Second pass: Create joint hierarchy and position links
    for (const joint of joints) {
      const parentNode = linkMap[joint.parent];
      const childNode = linkMap[joint.child];

      if (!parentNode || !childNode) {
        console.warn(`Missing parent or child link for joint ${joint.name}`);
        continue;
      }

      // Create joint node
      const jointNode = new BABYLON.TransformNode(joint.name, scene);
      
      // Set joint position and orientation relative to parent
      jointNode.position = new BABYLON.Vector3(joint.xyz[0], joint.xyz[1], joint.xyz[2]);
      jointNode.rotationQuaternion = rpyToQuaternion(joint.rpy[0], joint.rpy[1], joint.rpy[2]);

      // Establish hierarchy: parent -> joint -> child
      jointNode.parent = parentNode;
      childNode.parent = jointNode;
    }

    // Find root links (links with no parent joints)
    const childLinks = new Set(joints.map(j => j.child));
    const rootLinks = links.filter(link => !childLinks.has(link.name));

    // Connect root links to robot root
    rootLinks.forEach(rootLink => {
      const rootNode = linkMap[rootLink.name];
      rootNode.parent = robotRoot;
    });

    // Third pass: Load visual meshes
    for (const link of links) {
      const linkNode = linkMap[link.name];

      for (const visual of link.visuals) {
        const visualNode = new BABYLON.TransformNode(`${link.name}_visual`, scene);
        visualNode.position = new BABYLON.Vector3(visual.xyz[0], visual.xyz[1], visual.xyz[2]);
        visualNode.rotationQuaternion = rpyToQuaternion(visual.rpy[0], visual.rpy[1], visual.rpy[2]);
        visualNode.parent = linkNode;

        try {
          const meshPath = visual.filename.replace('../', '');
          const result = await BABYLON.SceneLoader.ImportMeshAsync("", `${baseUrl}/`, meshPath, scene);
          
          const mesh = result.meshes[0];
          if (mesh) {
            mesh.parent = visualNode;

            if (visual.scale) {
              mesh.scaling = new BABYLON.Vector3(visual.scale[0], visual.scale[1], visual.scale[2]);
            }

            // Setup material
            if (mesh instanceof BABYLON.Mesh) {
              const material = new BABYLON.StandardMaterial(`${link.name}_material`, scene);
              material.backFaceCulling = false;
              mesh.material = material;
            }
          }
        } catch (error) {
          console.error(`Failed to load mesh for link ${link.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error loading URDF:', error);
    throw error;
  }
}
