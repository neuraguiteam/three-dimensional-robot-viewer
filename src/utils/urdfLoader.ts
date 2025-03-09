
import * as BABYLON from '@babylonjs/core';
import { parseURDF } from './urdfParser';
import { URDFLink, URDFJoint } from './urdfTypes';

function rpyToQuaternion(roll: number, pitch: number, yaw: number): BABYLON.Quaternion {
  return BABYLON.Quaternion.FromEulerAngles(roll, pitch, yaw);
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

    const robotRoot = new BABYLON.TransformNode("robotRoot", scene);
    robotRoot.rotation = new BABYLON.Vector3(0, 0, Math.PI/2);

    const linkMap = createLinks(scene, links, baseUrl);
    const jointMap = createJoints(scene, joints, linkMap);
    setupRootLinks(links, joints, linkMap, robotRoot);

  } catch (error) {
    console.error('Error loading URDF:', error);
    throw error;
  }
}

function createLinks(
  scene: BABYLON.Scene, 
  links: URDFLink[], 
  baseUrl: string
): Record<string, BABYLON.TransformNode> {
  const linkMap: Record<string, BABYLON.TransformNode> = {};

  links.forEach((link) => {
    const linkNode = new BABYLON.TransformNode(link.name, scene);
    linkMap[link.name] = linkNode;

    link.visuals.forEach(async (visual, idx) => {
      const meshRoot = new BABYLON.TransformNode(`${link.name}_visual_${idx}`, scene);
      const meshPath = visual.filename.replace('../', '');
      const meshUrl = `${baseUrl}/${meshPath}`;
      
      try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", meshUrl, scene);
        const mesh = result.meshes[0];
        
        meshRoot.position = new BABYLON.Vector3(visual.xyz[0], visual.xyz[1], visual.xyz[2]);
        meshRoot.rotationQuaternion = rpyToQuaternion(visual.rpy[0], visual.rpy[1], visual.rpy[2]);
        
        if (visual.scale) {
          meshRoot.scaling = new BABYLON.Vector3(visual.scale[0], visual.scale[1], visual.scale[2]);
        }

        mesh.parent = meshRoot;
        meshRoot.parent = linkNode;
      } catch (error) {
        console.error(`Failed to load mesh for link ${link.name}:`, error);
      }
    });
  });

  return linkMap;
}

function createJoints(
  scene: BABYLON.Scene,
  joints: URDFJoint[],
  linkMap: Record<string, BABYLON.TransformNode>
): Record<string, BABYLON.TransformNode> {
  const jointMap: Record<string, BABYLON.TransformNode> = {};

  joints.forEach((joint) => {
    const parentNode = linkMap[joint.parent];
    const childNode = linkMap[joint.child];

    if (!parentNode || !childNode) {
      console.warn(`Missing parent or child node for joint ${joint.name}`);
      return;
    }

    const jointNode = new BABYLON.TransformNode(joint.name, scene);
    jointNode.position = new BABYLON.Vector3(joint.xyz[0], joint.xyz[1], joint.xyz[2]);
    jointNode.rotationQuaternion = rpyToQuaternion(joint.rpy[0], joint.rpy[1], joint.rpy[2]);

    jointNode.metadata = {
      type: joint.type,
      axis: joint.axis
    };

    jointNode.parent = parentNode;
    childNode.parent = jointNode;
    
    jointMap[joint.name] = jointNode;
  });

  return jointMap;
}

function setupRootLinks(
  links: URDFLink[],
  joints: URDFJoint[],
  linkMap: Record<string, BABYLON.TransformNode>,
  robotRoot: BABYLON.TransformNode
): void {
  const childLinks = new Set(joints.map(j => j.child));
  links.forEach(link => {
    if (!childLinks.has(link.name)) {
      const rootLink = linkMap[link.name];
      if (rootLink) {
        rootLink.parent = robotRoot;
      }
    }
  });
}

