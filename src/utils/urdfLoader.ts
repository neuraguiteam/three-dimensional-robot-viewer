
import * as BABYLON from '@babylonjs/core';
import { parseURDF } from './urdfParser';
import { URDFLink, URDFJoint } from './urdfTypes';

function rpyToQuaternion(roll: number, pitch: number, yaw: number): BABYLON.Quaternion {
  return BABYLON.Quaternion.FromEulerAngles(roll, pitch, yaw);
}

function createJointConstraint(joint: URDFJoint, jointNode: BABYLON.TransformNode, scene: BABYLON.Scene) {
  if (!joint.axis) return;

  const axis = new BABYLON.Vector3(joint.axis[0], joint.axis[1], joint.axis[2]);
  
  switch (joint.type.toLowerCase()) {
    case 'revolute':
    case 'continuous':
      // Create a hinge constraint for revolute joints
      const hingeJoint = new BABYLON.HingeJoint({
        mainPivot: new BABYLON.Vector3(0, 0, 0),
        connectedPivot: new BABYLON.Vector3(0, 0, 0),
        mainAxis: axis,
        connectedAxis: axis,
      });
      break;
    case 'prismatic':
      // Create a slider constraint for prismatic joints
      const sliderJoint = new BABYLON.SliderJoint({
        mainAxis: axis,
        connectedAxis: axis,
      });
      break;
    // Add more joint types as needed
  }
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
    const linkMap = new Map<string, BABYLON.TransformNode>();
    const jointMap = new Map<string, BABYLON.TransformNode>();

    // First pass: Create all link nodes
    links.forEach(link => {
      const linkNode = new BABYLON.TransformNode(link.name, scene);
      linkNode.id = link.name;  // Set ID for easier debugging
      linkMap.set(link.name, linkNode);
    });

    // Second pass: Create joints and establish hierarchy
    joints.forEach(joint => {
      const jointNode = new BABYLON.TransformNode(joint.name, scene);
      jointNode.id = joint.name;  // Set ID for easier debugging
      jointMap.set(joint.name, jointNode);

      // Set joint position and rotation from joint origin
      jointNode.position = new BABYLON.Vector3(joint.xyz[0], joint.xyz[1], joint.xyz[2]);
      jointNode.rotationQuaternion = rpyToQuaternion(joint.rpy[0], joint.rpy[1], joint.rpy[2]);

      const parentLink = linkMap.get(joint.parent);
      const childLink = linkMap.get(joint.child);

      if (parentLink && childLink) {
        jointNode.parent = parentLink;
        childLink.parent = jointNode;

        // Create joint constraint based on joint type and axis
        createJointConstraint(joint, jointNode, scene);
      } else {
        console.warn(`Missing parent or child link for joint ${joint.name}`);
      }
    });

    // Find root links (links with no parent joint)
    const childLinks = new Set(joints.map(j => j.child));
    links.forEach(link => {
      if (!childLinks.has(link.name)) {
        const linkNode = linkMap.get(link.name);
        if (linkNode) {
          linkNode.parent = robotRoot;
        }
      }
    });

    // Load meshes for each link
    for (const link of links) {
      const linkNode = linkMap.get(link.name);
      if (!linkNode) {
        console.warn(`Missing node for link ${link.name}`);
        continue;
      }

      for (const visual of link.visuals) {
        const visualNode = new BABYLON.TransformNode(`${link.name}_visual`, scene);
        visualNode.position = new BABYLON.Vector3(visual.xyz[0], visual.xyz[1], visual.xyz[2]);
        visualNode.rotationQuaternion = rpyToQuaternion(visual.rpy[0], visual.rpy[1], visual.rpy[2]);
        
        if (visual.scale) {
          visualNode.scaling = new BABYLON.Vector3(
            visual.scale[0],
            visual.scale[1],
            visual.scale[2]
          );
        }

        const meshPath = visual.filename.replace('../', '');
        const lastSlashIndex = meshPath.lastIndexOf('/');
        const rootUrl = `${baseUrl}/${meshPath.substring(0, lastSlashIndex + 1)}`;
        const sceneFilename = meshPath.substring(lastSlashIndex + 1);

        try {
          const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            rootUrl,
            sceneFilename,
            scene
          );
          
          const mesh = result.meshes[0];
          mesh.parent = visualNode;
          visualNode.parent = linkNode;

        } catch (error) {
          console.error(`Failed to load mesh for link ${link.name}:`, error);
        }
      }
    }

    // Set initial robot orientation
    robotRoot.rotation = new BABYLON.Vector3(0, Math.PI, Math.PI/2);

  } catch (error) {
    console.error('Error loading URDF:', error);
    throw error;
  }
}
