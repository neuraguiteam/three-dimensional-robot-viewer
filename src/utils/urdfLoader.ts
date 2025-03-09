import * as BABYLON from '@babylonjs/core';

interface URDFLinkVisual {
  filename: string;
  scale?: [number, number, number];
  xyz: [number, number, number];
  rpy: [number, number, number];
}

interface URDFLink {
  name: string;
  visuals: URDFLinkVisual[];
}

interface URDFJoint {
  name: string;
  type: string;
  parent: string;
  child: string;
  xyz: [number, number, number];
  rpy: [number, number, number];
  axis?: [number, number, number];
}

function rpyToQuaternion(roll: number, pitch: number, yaw: number): BABYLON.Quaternion {
  return BABYLON.Quaternion.FromEulerAngles(roll, pitch, yaw);
}

async function parseURDF(urdfText: string): Promise<{
  links: URDFLink[];
  joints: URDFJoint[];
}> {
  const parser = new DOMParser();
  const xml = parser.parseFromString(urdfText, "application/xml");

  const links: URDFLink[] = [];
  const joints: URDFJoint[] = [];

  const linkElems = xml.querySelectorAll("robot > link");
  linkElems.forEach((linkEl) => {
    const linkName = linkEl.getAttribute("name") || "unnamed_link";
    const visuals: URDFLinkVisual[] = [];

    linkEl.querySelectorAll("visual").forEach((visualEl) => {
      const meshEl = visualEl.querySelector("geometry > mesh");
      if (!meshEl) return;

      const filename = meshEl.getAttribute("filename") || "";
      const scaleStr = meshEl.getAttribute("scale") || "1 1 1";
      const scaleVals = scaleStr.split(" ").map(Number);
      
      let xyz: [number, number, number] = [0, 0, 0];
      let rpy: [number, number, number] = [0, 0, 0];
      
      const originEl = visualEl.querySelector("origin");
      if (originEl) {
        const xyzStr = originEl.getAttribute("xyz") || "0 0 0";
        const rpyStr = originEl.getAttribute("rpy") || "0 0 0";
        xyz = xyzStr.split(" ").map(Number) as [number, number, number];
        rpy = rpyStr.split(" ").map(Number) as [number, number, number];
      }

      visuals.push({
        filename,
        scale: [scaleVals[0], scaleVals[1], scaleVals[2]],
        xyz,
        rpy
      });
    });

    links.push({ name: linkName, visuals });
  });

  const jointElems = xml.querySelectorAll("robot > joint");
  jointElems.forEach((jointEl) => {
    const name = jointEl.getAttribute("name") || "unnamed_joint";
    const type = jointEl.getAttribute("type") || "fixed";
    const parentEl = jointEl.querySelector("parent");
    const childEl = jointEl.querySelector("child");
    if (!parentEl || !childEl) return;

    const parent = parentEl.getAttribute("link") || "";
    const child = childEl.getAttribute("link") || "";

    let xyz: [number, number, number] = [0, 0, 0];
    let rpy: [number, number, number] = [0, 0, 0];
    
    const originEl = jointEl.querySelector("origin");
    if (originEl) {
      const xyzStr = originEl.getAttribute("xyz") || "0 0 0";
      const rpyStr = originEl.getAttribute("rpy") || "0 0 0";
      xyz = xyzStr.split(" ").map(Number) as [number, number, number];
      rpy = rpyStr.split(" ").map(Number) as [number, number, number];
    }

    let axis: [number, number, number] | undefined;
    const axisEl = jointEl.querySelector("axis");
    if (axisEl) {
      const axisStr = axisEl.getAttribute("xyz") || "0 0 0";
      axis = axisStr.split(" ").map(Number) as [number, number, number];
    }

    joints.push({ name, type, parent, child, xyz, rpy, axis });
  });

  return { links, joints };
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

    const linkMap: Record<string, BABYLON.TransformNode> = {};
    const jointMap: Record<string, BABYLON.TransformNode> = {};

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

    const childLinks = new Set(joints.map(j => j.child));
    links.forEach(link => {
      if (!childLinks.has(link.name)) {
        const rootLink = linkMap[link.name];
        if (rootLink) {
          rootLink.parent = robotRoot;
        }
      }
    });

  } catch (error) {
    console.error('Error loading URDF:', error);
    throw error;
  }
}
