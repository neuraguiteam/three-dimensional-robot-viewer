
import * as BABYLON from '@babylonjs/core';

export interface URDFLinkVisual {
  filename: string;
  scale?: [number, number, number];
  xyz: [number, number, number];
  rpy: [number, number, number];
}

export interface URDFLink {
  name: string;
  visuals: URDFLinkVisual[];
}

export interface URDFJoint {
  name: string;
  type: string;
  parent: string;
  child: string;
  xyz: [number, number, number];
  rpy: [number, number, number];
  axis?: [number, number, number];
}

