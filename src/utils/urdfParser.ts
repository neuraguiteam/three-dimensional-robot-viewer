
import { URDFLink, URDFJoint, URDFLinkVisual } from './urdfTypes';

export async function parseURDF(urdfText: string): Promise<{
  links: URDFLink[];
  joints: URDFJoint[];
}> {
  const parser = new DOMParser();
  const xml = parser.parseFromString(urdfText, "application/xml");

  const links: URDFLink[] = [];
  const joints: URDFJoint[] = [];

  // Parse links
  xml.querySelectorAll("robot > link").forEach((linkEl) => {
    const linkName = linkEl.getAttribute("name") || "unnamed_link";
    const visuals: URDFLinkVisual[] = [];

    linkEl.querySelectorAll("visual").forEach((visualEl) => {
      const meshEl = visualEl.querySelector("geometry > mesh");
      if (!meshEl) return;

      const filename = meshEl.getAttribute("filename") || "";
      const scaleStr = meshEl.getAttribute("scale") || "1 1 1";
      const scale = scaleStr.split(" ").map(Number) as [number, number, number];

      const originEl = visualEl.querySelector("origin");
      const xyz = (originEl?.getAttribute("xyz") || "0 0 0")
        .split(" ")
        .map(Number) as [number, number, number];
      const rpy = (originEl?.getAttribute("rpy") || "0 0 0")
        .split(" ")
        .map(Number) as [number, number, number];

      visuals.push({ filename, scale, xyz, rpy });
    });

    links.push({ name: linkName, visuals });
  });

  // Parse joints
  xml.querySelectorAll("robot > joint").forEach((jointEl) => {
    const name = jointEl.getAttribute("name") || "unnamed_joint";
    const type = jointEl.getAttribute("type") || "fixed";

    const parent = jointEl.querySelector("parent")?.getAttribute("link") || "";
    const child = jointEl.querySelector("child")?.getAttribute("link") || "";

    const originEl = jointEl.querySelector("origin");
    const xyz = (originEl?.getAttribute("xyz") || "0 0 0")
      .split(" ")
      .map(Number) as [number, number, number];
    const rpy = (originEl?.getAttribute("rpy") || "0 0 0")
      .split(" ")
      .map(Number) as [number, number, number];

    const axisEl = jointEl.querySelector("axis");
    const axis = axisEl ? 
      (axisEl.getAttribute("xyz") || "0 0 1")
        .split(" ")
        .map(Number) as [number, number, number] 
      : undefined;

    joints.push({ name, type, parent, child, xyz, rpy, axis });
  });

  return { links, joints };
}
