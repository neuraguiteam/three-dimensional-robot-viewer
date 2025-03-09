
import * as BABYLON from '@babylonjs/core';
import { parseURDF } from './urdfParser';
import { URDFLink, URDFJoint } from './urdfTypes';

// Cache for loaded meshes
const meshCache: { [key: string]: Promise<BABYLON.ISceneLoaderAsyncResult> } = {};

function rpyToQuaternion(roll: number, pitch: number, yaw: number): BABYLON.Quaternion {
  // Create rotation matrix from RPY
  const rotation = BABYLON.Matrix.RotationYawPitchRoll(yaw, pitch, roll);
  // Convert to quaternion
  const quaternion = BABYLON.Quaternion.FromRotationMatrix(rotation);
  return quaternion;
}

function buildRobotStructure(scene: BABYLON.Scene, links: URDFLink[], joints: URDFJoint[]) {
  const linkMap = new Map<string, BABYLON.TransformNode>();
  const jointMap = new Map<string, BABYLON.TransformNode>();

  // First create all link nodes with their origins
  links.forEach(link => {
    const node = new BABYLON.TransformNode(link.name, scene);
    linkMap.set(link.name, node);
  });

  // Create joint nodes and establish hierarchy
  joints.forEach(joint => {
    const jointNode = new BABYLON.TransformNode(joint.name, scene);
    jointMap.set(joint.name, jointNode);

    const parentLink = linkMap.get(joint.parent);
    const childLink = linkMap.get(joint.child);

    if (!parentLink || !childLink) {
      console.warn(`Missing parent or child for joint ${joint.name}`);
      return;
    }

    // Set joint's parent to parent link
    jointNode.parent = parentLink;
    
    // Set child link's parent to joint
    childLink.parent = jointNode;

    // Apply joint origin transform
    jointNode.position = new BABYLON.Vector3(joint.xyz[0], joint.xyz[1], joint.xyz[2]);
    jointNode.rotationQuaternion = rpyToQuaternion(joint.rpy[0], joint.rpy[1], joint.rpy[2]);

    // If joint has an axis, store it for articulation
    if (joint.axis) {
      const axisVector = new BABYLON.Vector3(joint.axis[0], joint.axis[1], joint.axis[2]);
      (jointNode as any).jointAxis = axisVector;
    }
  });

  return { linkMap, jointMap };
}

export async function loadURDFRobot(
  scene: BABYLON.Scene,
  urdfPath: string,
  baseUrl: string
): Promise<BABYLON.TransformNode> {
  try {
    const response = await fetch(urdfPath);
    const urdfContent = await response.text();
    const { links, joints } = await parseURDF(urdfContent);

    // Create root node for the entire robot
    const robotRoot = new BABYLON.TransformNode("robotRoot", scene);
    
    // Set initial robot position and orientation
    robotRoot.position = new BABYLON.Vector3(0, 2, 0); // Lift robot above ground
    robotRoot.rotation = new BABYLON.Vector3(0, Math.PI / 4, 0); // Rotate 45 degrees

    const { linkMap } = buildRobotStructure(scene, links, joints);

    // Find root links (links that aren't children in any joint)
    const childLinks = new Set(joints.map(j => j.child));
    const rootLinks = links.filter(link => !childLinks.has(link.name));

    // Attach root links to robot root
    rootLinks.forEach(rootLink => {
      const rootNode = linkMap.get(rootLink.name);
      if (rootNode) rootNode.parent = robotRoot;
    });

    // Load meshes for visual elements
    const meshPromises: Promise<void>[] = [];

    links.forEach(link => {
      const linkNode = linkMap.get(link.name);
      if (!linkNode) return;

      link.visuals.forEach(visual => {
        const visualNode = new BABYLON.TransformNode(`${link.name}_visual`, scene);
        visualNode.position = new BABYLON.Vector3(visual.xyz[0], visual.xyz[1], visual.xyz[2]);
        visualNode.rotationQuaternion = rpyToQuaternion(visual.rpy[0], visual.rpy[1], visual.rpy[2]);
        visualNode.parent = linkNode;

        const meshPath = visual.filename.replace('../', '');
        const fullPath = `${baseUrl}/${meshPath}`;

        if (!meshCache[fullPath]) {
          const lastSlashIndex = fullPath.lastIndexOf('/');
          const rootUrl = fullPath.substring(0, lastSlashIndex + 1);
          const sceneFilename = fullPath.substring(lastSlashIndex + 1);
          
          meshCache[fullPath] = BABYLON.SceneLoader.ImportMeshAsync("", rootUrl, sceneFilename, scene);
        }

        const loadPromise = meshCache[fullPath].then(result => {
          const mesh = result.meshes[0].clone(`${link.name}_mesh`);
          mesh.parent = visualNode;

          if (visual.scale) {
            mesh.scaling = new BABYLON.Vector3(visual.scale[0], visual.scale[1], visual.scale[2]);
          }

          if (mesh instanceof BABYLON.Mesh) {
            const material = new BABYLON.StandardMaterial(`${link.name}_material`, scene);
            material.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
            material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
            material.backFaceCulling = false;
            mesh.material = material;
          }
        });

        meshPromises.push(loadPromise);
      });
    });

    await Promise.all(meshPromises);
    return robotRoot;

  } catch (error) {
    console.error('Error loading URDF:', error);
    throw error;
  }
}
