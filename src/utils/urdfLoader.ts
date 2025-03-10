
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
    const linkMap = new Map<string, BABYLON.TransformNode>();
    const jointMap = new Map<string, BABYLON.TransformNode>();
    
    // Debug logging
    console.log(`Parsed ${links.length} links and ${joints.length} joints`);

    // First pass: Create all link nodes
    links.forEach(link => {
      const linkNode = new BABYLON.TransformNode(link.name, scene);
      linkMap.set(link.name, linkNode);
      console.log(`Created link node: ${link.name}`);
    });

    // Second pass: Create joints and establish hierarchy
    joints.forEach(joint => {
      const jointNode = new BABYLON.TransformNode(joint.name, scene);
      jointMap.set(joint.name, jointNode);

      // Set joint position and rotation from joint origin
      jointNode.position = new BABYLON.Vector3(joint.xyz[0], joint.xyz[1], joint.xyz[2]);
      jointNode.rotationQuaternion = rpyToQuaternion(joint.rpy[0], joint.rpy[1], joint.rpy[2]);

      // Create proper parent-child relationship
      const parentLink = linkMap.get(joint.parent);
      const childLink = linkMap.get(joint.child);

      if (parentLink && childLink) {
        jointNode.parent = parentLink;
        childLink.parent = jointNode;
        console.log(`Connected joint ${joint.name}: ${joint.parent} → ${joint.child}`);
      } else {
        console.warn(`Missing link for joint ${joint.name}: parent=${joint.parent}, child=${joint.child}`);
      }
    });

    // Connect root links (links with no parent joint) to robot root
    const childLinks = new Set(joints.map(j => j.child));
    const rootLinks = links.filter(link => !childLinks.has(link.name));
    
    console.log(`Found ${rootLinks.length} root links`);
    rootLinks.forEach(link => {
      const linkNode = linkMap.get(link.name);
      if (linkNode) {
        linkNode.parent = robotRoot;
        console.log(`Connected root link ${link.name} to robot root`);
      }
    });

    // Load meshes for each link
    for (const link of links) {
      const linkNode = linkMap.get(link.name);
      if (!linkNode) {
        console.warn(`Missing link node for ${link.name}`);
        continue;
      }

      for (const visual of link.visuals) {
        const visualNode = new BABYLON.TransformNode(`${link.name}_visual`, scene);
        visualNode.position = new BABYLON.Vector3(visual.xyz[0], visual.xyz[1], visual.xyz[2]);
        visualNode.rotationQuaternion = rpyToQuaternion(visual.rpy[0], visual.rpy[1], visual.rpy[2]);
        visualNode.parent = linkNode;
        
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
          console.log(`Loading mesh: ${rootUrl}${sceneFilename} for link ${link.name}`);
          const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            rootUrl,
            sceneFilename,
            scene
          );
          
          if (result.meshes.length > 0) {
            const mesh = result.meshes[0];
            mesh.parent = visualNode;
            
            // Create a material for the mesh
            const material = new BABYLON.StandardMaterial(`${link.name}_material`, scene);
            material.diffuseColor = new BABYLON.Color3(0.75, 0.75, 0.75);
            material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
            
            // Apply material to all meshes in the result
            result.meshes.forEach(m => {
              if (m instanceof BABYLON.Mesh) {
                m.material = material;
              }
            });
            
            console.log(`Successfully loaded mesh for ${link.name}`);
          } else {
            console.warn(`No meshes loaded for ${link.name}`);
          }
        } catch (error) {
          console.error(`Failed to load mesh for link ${link.name}:`, error);
        }
      }
    }

    // Apply initial configuration to joints (if needed)
    joints.forEach(joint => {
      if (joint.type === "fixed") return;
      
      const jointNode = jointMap.get(joint.name);
      if (jointNode) {
        // Initialize joint to a neutral position
        // For continuous joints, we can leave them at the default position
        if (joint.type === "revolute" && joint.axis) {
          // Optional: set initial joint positions if specified
          console.log(`Initialized joint ${joint.name} with axis ${joint.axis}`);
        }
      }
    });

    // Set initial robot orientation and position
    robotRoot.rotation = new BABYLON.Vector3(0, Math.PI, Math.PI/2);
    
    // Optional: Adjust camera to focus on the robot
    const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
    if (camera) {
      camera.target = new BABYLON.Vector3(0, 1, 0); // Adjust as needed
      camera.alpha = Math.PI/2;
      camera.beta = Math.PI/3;
      camera.radius = 10;
    }

    console.log("URDF Robot loaded successfully");

  } catch (error) {
    console.error('Error loading URDF:', error);
    throw error;
  }
}
