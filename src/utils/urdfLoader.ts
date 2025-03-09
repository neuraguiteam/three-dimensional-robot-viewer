
import * as BABYLON from '@babylonjs/core';
import { parseURDF } from './urdfParser';
import { URDFLink, URDFJoint } from './urdfTypes';

// Cache for loaded meshes
const meshCache: { [key: string]: Promise<BABYLON.ISceneLoaderAsyncResult> } = {};

function rpyToQuaternion(roll: number, pitch: number, yaw: number): BABYLON.Quaternion {
  return BABYLON.Quaternion.RotationYawPitchRoll(yaw, pitch, roll);
}

function buildRobotStructure(scene: BABYLON.Scene, links: URDFLink[], joints: URDFJoint[]) {
  const linkMap = new Map<string, BABYLON.TransformNode>();
  const jointMap = new Map<string, BABYLON.TransformNode>();

  // First create all link nodes
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

    // Set up hierarchy: parentLink -> jointNode -> childLink
    jointNode.parent = parentLink;
    childLink.parent = jointNode;

    // Apply joint transforms
    jointNode.position = new BABYLON.Vector3(joint.xyz[0], joint.xyz[1], joint.xyz[2]);
    jointNode.rotationQuaternion = rpyToQuaternion(joint.rpy[0], joint.rpy[1], joint.rpy[2]);
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

    const robotRoot = new BABYLON.TransformNode("robotRoot", scene);
    const { linkMap } = buildRobotStructure(scene, links, joints);

    // Find and attach root links
    const childLinks = new Set(joints.map(j => j.child));
    const rootLinks = links.filter(link => !childLinks.has(link.name));
    rootLinks.forEach(rootLink => {
      const rootNode = linkMap.get(rootLink.name);
      if (rootNode) rootNode.parent = robotRoot;
    });

    // Load meshes concurrently
    const meshPromises: Promise<void>[] = [];

    links.forEach(link => {
      const linkNode = linkMap.get(link.name);
      if (!linkNode) return;

      link.visuals.forEach(visual => {
        const visualNode = new BABYLON.TransformNode(`${link.name}_visual`, scene);
        visualNode.position = new BABYLON.Vector3(visual.xyz[0], visual.xyz[1], visual.xyz[2]);
        visualNode.rotationQuaternion = rpyToQuaternion(visual.rpy[0], visual.rpy[1], visual.rpy[2]);
        visualNode.parent = linkNode;

        // Fix the mesh path by correctly joining the baseUrl and meshPath
        const meshPath = visual.filename.replace('../', '');
        const fullPath = `${baseUrl}/${meshPath}`;

        if (!meshCache[fullPath]) {
          // Split the path into rootUrl and sceneFilename for SceneLoader
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

