import * as BABYLON from '@babylonjs/core';
import { URDFLink, URDFJoint, URDFLinkVisual, URDFJointLimits } from './urdfTypes';

interface LoaderOptions {
  parseVisual?: boolean;
  parseCollision?: boolean;
  packages?: { [key: string]: string };
  workingPath?: string;
  fetchOptions?: RequestInit;
}

export class BabylonURDFLoader {
  private scene: BABYLON.Scene;
  private options: LoaderOptions;
  private linkMap: Map<string, BABYLON.TransformNode>;
  private jointMap: Map<string, BABYLON.TransformNode>;
  private materialMap: Map<string, BABYLON.Material>;

  constructor(scene: BABYLON.Scene, options: LoaderOptions = {}) {
    this.scene = scene;
    this.options = {
      parseVisual: true,
      parseCollision: false,
      packages: {},
      workingPath: '',
      fetchOptions: {},
      ...options
    };
    this.linkMap = new Map();
    this.jointMap = new Map();
    this.materialMap = new Map();
  }

  async loadAsync(urdfPath: string): Promise<BABYLON.TransformNode> {
    try {
      const response = await fetch(urdfPath, this.options.fetchOptions);
      const text = await response.text();
      return await this.parse(text);
    } catch (error) {
      console.error('Error loading URDF:', error);
      throw error;
    }
  }

  private async parse(content: string): Promise<BABYLON.TransformNode> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');
    return await this.processUrdf(doc);
  }

  private async processUrdf(doc: Document): Promise<BABYLON.TransformNode> {
    const robotEl = doc.querySelector('robot');
    if (!robotEl) throw new Error('No robot element found');

    await this.processMaterials(robotEl);
    await this.processLinks(robotEl);
    await this.processJoints(robotEl);

    return this.assembleRobot();
  }

  private async processMaterials(robotEl: Element): Promise<void> {
    const materials = robotEl.querySelectorAll('material');
    materials.forEach((material) => {
      const name = material.getAttribute('name');
      if (!name) return;

      const colorEl = material.querySelector('color');
      const textureEl = material.querySelector('texture');

      let pbr: BABYLON.PBRMaterial;
      if (colorEl) {
        const rgba = colorEl.getAttribute('rgba')?.split(' ').map(Number) || [1, 1, 1, 1];
        pbr = new BABYLON.PBRMaterial(name, this.scene);
        pbr.albedoColor = new BABYLON.Color3(rgba[0], rgba[1], rgba[2]);
      } else if (textureEl) {
        const filename = textureEl.getAttribute('filename');
        if (filename) {
          pbr = new BABYLON.PBRMaterial(name, this.scene);
          pbr.albedoTexture = new BABYLON.Texture(this.resolvePath(filename), this.scene);
        }
      }

      this.materialMap.set(name, pbr!);
    });
  }

  private async processLinks(robotEl: Element): Promise<void> {
    const links = robotEl.querySelectorAll('link');
    for (const link of links) {
      const name = link.getAttribute('name');
      if (!name) continue;

      const linkNode = new BABYLON.TransformNode(name, this.scene);
      this.linkMap.set(name, linkNode);

      if (this.options.parseVisual) {
        const visuals = link.querySelectorAll('visual');
        for (const visual of visuals) {
          await this.processVisual(visual, linkNode);
        }
      }
    }
  }

  private async processJoints(robotEl: Element): Promise<void> {
    const joints = robotEl.querySelectorAll('joint');
    joints.forEach((joint) => {
      const name = joint.getAttribute('name');
      const type = joint.getAttribute('type');
      if (!name || !type) return;

      const parentEl = joint.querySelector('parent');
      const childEl = joint.querySelector('child');
      if (!parentEl || !childEl) return;

      const parentLink = this.linkMap.get(parentEl.getAttribute('link') || '');
      const childLink = this.linkMap.get(childEl.getAttribute('link') || '');
      if (!parentLink || !childLink) return;

      const jointNode = new BABYLON.TransformNode(name, this.scene);
      this.jointMap.set(name, jointNode);

      // Process origin
      const originEl = joint.querySelector('origin');
      if (originEl) {
        const xyz = (originEl.getAttribute('xyz') || '0 0 0').split(' ').map(Number);
        const rpy = (originEl.getAttribute('rpy') || '0 0 0').split(' ').map(Number);
        
        jointNode.position = new BABYLON.Vector3(xyz[0], xyz[1], xyz[2]);
        jointNode.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(rpy[0], rpy[1], rpy[2]);
      }

      // Process axis
      const axisEl = joint.querySelector('axis');
      if (axisEl) {
        const axis = (axisEl.getAttribute('xyz') || '0 0 0').split(' ').map(Number);
        (jointNode as any).jointAxis = new BABYLON.Vector3(axis[0], axis[1], axis[2]);
        (jointNode as any).jointType = type;
      }

      // Process limits
      const limitEl = joint.querySelector('limit');
      if (limitEl) {
        (jointNode as any).jointLimits = {
          lower: parseFloat(limitEl.getAttribute('lower') || '0'),
          upper: parseFloat(limitEl.getAttribute('upper') || '0'),
          effort: parseFloat(limitEl.getAttribute('effort') || '0'),
          velocity: parseFloat(limitEl.getAttribute('velocity') || '0')
        };
      }

      // Set up hierarchy
      jointNode.parent = parentLink;
      childLink.parent = jointNode;

      this.createJointConstraint(type, jointNode, parentLink);
    });
  }

  private async processVisual(visualEl: Element, parentNode: BABYLON.TransformNode): Promise<void> {
    const geometryEl = visualEl.querySelector('geometry');
    if (!geometryEl) return;

    const meshEl = geometryEl.querySelector('mesh');
    if (meshEl) {
      const filename = meshEl.getAttribute('filename');
      if (!filename) return;

      const fullPath = this.resolvePath(filename);
      const fileExtension = fullPath.split('.').pop()?.toLowerCase();

      try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync('', 
          fullPath.substring(0, fullPath.lastIndexOf('/') + 1),
          fullPath.substring(fullPath.lastIndexOf('/') + 1),
          this.scene
        );

        const mesh = result.meshes[0];
        
        // Process origin
        const originEl = visualEl.querySelector('origin');
        if (originEl) {
          const xyz = (originEl.getAttribute('xyz') || '0 0 0').split(' ').map(Number);
          const rpy = (originEl.getAttribute('rpy') || '0 0 0').split(' ').map(Number);
          
          mesh.position = new BABYLON.Vector3(xyz[0], xyz[1], xyz[2]);
          mesh.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(rpy[0], rpy[1], rpy[2]);
        }

        // Process material
        const materialEl = visualEl.querySelector('material');
        if (materialEl) {
          const materialName = materialEl.getAttribute('name');
          if (materialName) {
            const material = this.materialMap.get(materialName);
            if (material) {
              mesh.material = material;
            }
          }
        }

        mesh.parent = parentNode;
      } catch (error) {
        console.error(`Error loading mesh ${filename}:`, error);
      }
    }
  }

  private createJointConstraint(type: string, jointNode: BABYLON.TransformNode, parentNode: BABYLON.TransformNode): void {
    const axis = (jointNode as any).jointAxis;
    if (!axis) return;

    switch (type.toLowerCase()) {
      case 'revolute':
      case 'continuous': {
        const hinge = new BABYLON.HingeJoint({
          mainPivot: new BABYLON.Vector3(0, 0, 0),
          connectedPivot: new BABYLON.Vector3(0, 0, 0),
          mainAxis: axis,
          connectedAxis: axis,
        });

        if (type === 'revolute' && (jointNode as any).jointLimits) {
          const limits = (jointNode as any).jointLimits;
          const physicsJoint = new BABYLON.PhysicsJoint(BABYLON.PhysicsJoint.HingeJoint, {
            mainPivot: new BABYLON.Vector3(0, 0, 0),
            connectedPivot: new BABYLON.Vector3(0, 0, 0),
            mainAxis: axis,
            connectedAxis: axis,
            nativeParams: { limit: { low: limits.lower, high: limits.upper } }
          });
        }
        break;
      }
      case 'prismatic': {
        const prismaticNode = new BABYLON.TransformNode(`${jointNode.name}_prismatic`, this.scene);
        prismaticNode.parent = parentNode;
        (prismaticNode as any).slidingAxis = axis;
        
        if ((jointNode as any).jointLimits) {
          const limits = (jointNode as any).jointLimits;
          (prismaticNode as any).limits = {
            lower: limits.lower || 0,
            upper: limits.upper || 0
          };
        }
        break;
      }
    }
  }

  private resolvePath(path: string): string {
    if (path.startsWith('package://')) {
      const [prefix, ...rest] = path.substring(10).split('/');
      const packagePath = this.options.packages?.[prefix];
      if (packagePath) {
        return `${packagePath}/${rest.join('/')}`;
      }
    }

    if (path.startsWith('../')) {
      const basePath = this.options.workingPath.endsWith('/') 
        ? this.options.workingPath.slice(0, -1) 
        : this.options.workingPath;
      
      const parentPath = basePath.split('/').slice(0, -1).join('/');
      const relativePath = path.substring(3); // Remove ../
      return `${parentPath}/${relativePath}`.replace(/\/+/g, '/');
    }

    if (path.startsWith('http') || path.startsWith('/')) {
      return path;
    }

    const basePath = this.options.workingPath.endsWith('/') 
      ? this.options.workingPath 
      : `${this.options.workingPath}/`;
    return `${basePath}${path}`.replace(/\/+/g, '/');
  }

  private assembleRobot(): BABYLON.TransformNode {
    const robotRoot = new BABYLON.TransformNode('robotRoot', this.scene);
    
    // Find root links (links with no parent joint)
    const childLinks = new Set(Array.from(this.jointMap.values())
      .map(joint => joint.getChildren()[0].name));

    this.linkMap.forEach((linkNode, linkName) => {
      if (!childLinks.has(linkName)) {
        linkNode.parent = robotRoot;
      }
    });

    robotRoot.rotation = new BABYLON.Vector3(0, Math.PI, Math.PI/2);
    return robotRoot;
  }
}
