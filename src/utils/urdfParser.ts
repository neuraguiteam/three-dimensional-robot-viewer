
import { URDFLink, URDFJoint, URDFLinkVisual } from './urdfTypes';

export async function parseURDF(urdfText: string): Promise<{
  links: URDFLink[];
  joints: URDFJoint[];
}> {
  const parser = new DOMParser();
  const xml = parser.parseFromString(urdfText, "application/xml");

  // Check for errors in parsing
  const parseError = xml.querySelector("parsererror");
  if (parseError) {
    console.error("XML parsing error:", parseError.textContent);
    throw new Error("Failed to parse URDF XML");
  }

  return {
    links: parseLinks(xml),
    joints: parseJoints(xml)
  };
}

function parseLinks(xml: Document): URDFLink[] {
  const links: URDFLink[] = [];
  const linkElems = xml.querySelectorAll("robot > link");

  linkElems.forEach((linkEl) => {
    const linkName = linkEl.getAttribute("name") || "unnamed_link";
    const visuals = parseVisuals(linkEl);
    console.log(`Parsing link: ${linkName} with ${visuals.length} visuals`);
    links.push({ name: linkName, visuals });
  });

  return links;
}

function parseVisuals(linkEl: Element): URDFLinkVisual[] {
  const visuals: URDFLinkVisual[] = [];

  linkEl.querySelectorAll("visual").forEach((visualEl) => {
    const meshEl = visualEl.querySelector("geometry > mesh");
    if (!meshEl) return;

    const filename = meshEl.getAttribute("filename") || "";
    if (!filename) {
      console.warn("Missing filename in mesh element");
      return;
    }

    const scaleStr = meshEl.getAttribute("scale") || "1 1 1";
    const scaleVals = scaleStr.split(" ").map(Number);
    
    const [xyz, rpy] = parseOrigin(visualEl);

    visuals.push({
      filename,
      scale: [scaleVals[0], scaleVals[1], scaleVals[2]],
      xyz,
      rpy
    });
  });

  return visuals;
}

function parseJoints(xml: Document): URDFJoint[] {
  const joints: URDFJoint[] = [];
  const jointElems = xml.querySelectorAll("robot > joint");

  jointElems.forEach((jointEl) => {
    const name = jointEl.getAttribute("name") || "unnamed_joint";
    const type = jointEl.getAttribute("type") || "fixed";
    const parentEl = jointEl.querySelector("parent");
    const childEl = jointEl.querySelector("child");
    
    if (!parentEl || !childEl) {
      console.warn(`Joint ${name} missing parent or child element`);
      return;
    }

    const parent = parentEl.getAttribute("link") || "";
    const child = childEl.getAttribute("link") || "";
    const [xyz, rpy] = parseOrigin(jointEl);
    const axis = parseAxis(jointEl);

    console.log(`Parsing joint: ${name}, type: ${type}, parent: ${parent}, child: ${child}`);
    joints.push({ name, type, parent, child, xyz, rpy, axis });
  });

  return joints;
}

function parseOrigin(element: Element): [[number, number, number], [number, number, number]] {
  let xyz: [number, number, number] = [0, 0, 0];
  let rpy: [number, number, number] = [0, 0, 0];
  
  const originEl = element.querySelector("origin");
  if (originEl) {
    const xyzStr = originEl.getAttribute("xyz") || "0 0 0";
    const rpyStr = originEl.getAttribute("rpy") || "0 0 0";
    
    xyz = xyzStr.split(" ").map(parseFloat) as [number, number, number];
    rpy = rpyStr.split(" ").map(parseFloat) as [number, number, number];
    
    // Validate parsed values
    xyz = xyz.map(val => isNaN(val) ? 0 : val) as [number, number, number];
    rpy = rpy.map(val => isNaN(val) ? 0 : val) as [number, number, number];
  }

  return [xyz, rpy];
}

function parseAxis(jointEl: Element): [number, number, number] | undefined {
  const axisEl = jointEl.querySelector("axis");
  if (axisEl) {
    const axisStr = axisEl.getAttribute("xyz") || "0 0 0";
    const axis = axisStr.split(" ").map(parseFloat) as [number, number, number];
    
    // Validate parsed values
    return axis.map(val => isNaN(val) ? 0 : val) as [number, number, number];
  }
  return undefined;
}
