
import * as BABYLON from '@babylonjs/core';
import { parseURDF } from './urdfParser';
import { URDFLink, URDFJoint } from './urdfTypes';

function rpyToQuaternion(roll: number, pitch: number, yaw: number): BABYLON.Quaternion {
  const quat = BABYLON.Quaternion.Identity();
  const tempQuat = BABYLON.Quaternion.Identity();

  // Convert RPY (fixed-axis) to quaternion using multiplication order: Yaw * Pitch * Roll
  BABYLON.Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, tempQuat);
  quat.multiplyToRef(tempQuat, quat);
  BABYLON.Quaternion.RotationYawPitchRollToRef(0, pitch, 0, tempQuat);
  quat.multiplyToRef(tempQuat, quat);
  BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, roll, tempQuat);
  quat.multiplyToRef(tempQuat, quat);

  return quat;
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

    // Create transform nodes for all links first
    const linkMap: Record<string, BABYLON.TransformNode> = {};
    
    // First pass: Create all link nodes
    for (const link of links) {
      const linkNode = new BABYLON.TransformNode(link.name, scene);
      linkMap[link.name] = linkNode;
    }

    // Second pass: Create all joints and establish hierarchy
    for (const joint of joints) {
      const parentLink = linkMap[joint.parent];
      const childLink = linkMap[joint.child];

      if (!parentLink || !childLink) {
        console.warn(`Missing parent or child link for joint ${joint.name}`);
        continue;
      }

      // Create joint node
      const jointNode = new BABYLON.TransformNode(joint.name, scene);
      
      // Set joint position and orientation
      jointNode.position = new BABYLON.Vector3(joint.xyz[0], joint.xyz[1], joint.xyz[2]);
      jointNode.rotationQuaternion = rpyToQuaternion(joint.rpy[0], joint.rpy[1], joint.rpy[2]);

      // Establish hierarchy: parent link -> joint -> child link
      jointNode.setParent(parentLink);
      childLink.setParent(jointNode);
    }

    // Third pass: Load visual meshes for all links
    for (const link of links) {
      const linkNode = linkMap[link.name];
      
      // Load visual meshes for the link
      for (let i = 0; i < link.visuals.length; i++) {
        const visual = link.visuals[i];
        const visualRoot = new BABYLON.TransformNode(`${link.name}_visual_${i}`, scene);
        
        try {
          const meshPath = visual.filename.replace('../', '');
          const meshUrl = `${baseUrl}/${meshPath}`;
          
          // Load the mesh
          const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", meshUrl, scene);
          const mesh = result.meshes[0];

          // Set visual transforms relative to link
          visualRoot.position = new BABYLON.Vector3(
            visual.xyz[0],
            visual.xyz[1],
            visual.xyz[2]
          );
          
          visualRoot.rotationQuaternion = rpyToQuaternion(
            visual.rpy[0],
            visual.rpy[1],
            visual.rpy[2]
          );

          if (visual.scale) {
            mesh.scaling = new BABYLON.Vector3(
              visual.scale[0],
              visual.scale[1],
              visual.scale[2]
            );
          }

          // Parent the mesh to its visual root
          mesh.setParent(visualRoot);
          visualRoot.setParent(linkNode);

          // Set up material
          if (mesh instanceof BABYLON.Mesh) {
            const material = new BABYLON.StandardMaterial(`${link.name}_material`, scene);
            material.backFaceCulling = false;
            mesh.material = material;
          }
        } catch (error) {
          console.error(`Failed to load mesh for link ${link.name}:`, error);
        }
      }
    }

    // Find the root link (link that is not a child in any joint)
    const childLinks = new Set(joints.map(j => j.child));
    const rootLinks = Object.keys(linkMap).filter(linkName => !childLinks.has(linkName));

    // Create a root node for the entire robot
    const robotRoot = new BABYLON.TransformNode("robotRoot", scene);
    
    // Parent root links to the robot root
    rootLinks.forEach(rootLinkName => {
      const rootLink = linkMap[rootLinkName];
      rootLink.setParent(robotRoot);
    });

  } catch (error) {
    console.error('Error loading URDF:', error);
    throw error;
  }
}

