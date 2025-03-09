
import * as BABYLON from '@babylonjs/core';
import { parseURDF } from './urdfParser';
import { URDFLink, URDFJoint } from './urdfTypes';

function rpyToQuaternion(roll: number, pitch: number, yaw: number): BABYLON.Quaternion {
    // Create a new quaternion for the rotation
    const quat = new BABYLON.Quaternion();
    
    // Convert Euler angles to quaternion in ZYX order (which is what URDF uses)
    BABYLON.Quaternion.RotationYawPitchRollToRef(yaw, pitch, roll, quat);
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

        // Create the robot root node
        const robotRoot = new BABYLON.TransformNode("robotRoot", scene);
        
        // Create transform nodes for all links first
        const linkMap = await createLinks(scene, links, baseUrl);
        
        // Then set up joint hierarchy and transformations
        setupJointHierarchy(scene, joints, linkMap, robotRoot);

    } catch (error) {
        console.error('Error loading URDF:', error);
        throw error;
    }
}

async function createLinks(
    scene: BABYLON.Scene, 
    links: URDFLink[], 
    baseUrl: string
): Promise<Record<string, BABYLON.TransformNode>> {
    const linkMap: Record<string, BABYLON.TransformNode> = {};

    for (const link of links) {
        // Create a transform node for the link
        const linkNode = new BABYLON.TransformNode(link.name, scene);
        linkMap[link.name] = linkNode;

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

                // Apply visual transforms
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

    return linkMap;
}

function setupJointHierarchy(
    scene: BABYLON.Scene,
    joints: URDFJoint[],
    linkMap: Record<string, BABYLON.TransformNode>,
    robotRoot: BABYLON.TransformNode
): void {
    // First, find the root links (links that are not children in any joint)
    const childLinks = new Set(joints.map(j => j.child));
    const rootLinks = Object.keys(linkMap).filter(linkName => !childLinks.has(linkName));

    // Parent root links directly to the robot root
    rootLinks.forEach(rootLinkName => {
        const rootLink = linkMap[rootLinkName];
        rootLink.setParent(robotRoot);
    });

    // Create and setup joints
    joints.forEach(joint => {
        const parentLink = linkMap[joint.parent];
        const childLink = linkMap[joint.child];

        if (!parentLink || !childLink) {
            console.warn(`Missing parent or child link for joint ${joint.name}`);
            return;
        }

        // Create a transform node for the joint
        const jointNode = new BABYLON.TransformNode(joint.name, scene);

        // Set joint position and orientation
        jointNode.position = new BABYLON.Vector3(joint.xyz[0], joint.xyz[1], joint.xyz[2]);
        jointNode.rotationQuaternion = rpyToQuaternion(joint.rpy[0], joint.rpy[1], joint.rpy[2]);

        // Setup joint metadata
        jointNode.metadata = {
            type: joint.type,
            axis: joint.axis ? new BABYLON.Vector3(joint.axis[0], joint.axis[1], joint.axis[2]) : undefined
        };

        // Setup the hierarchy: parent link -> joint -> child link
        jointNode.setParent(parentLink);
        childLink.setParent(jointNode);
    });
}
