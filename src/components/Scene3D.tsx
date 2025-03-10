
import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';
import '@babylonjs/loaders';
import { loadURDFRobot } from '../utils/urdfLoader';

interface Scene3DProps {
  onSceneReady?: (scene: BABYLON.Scene) => void;
}

const Scene3D = ({ onSceneReady }: Scene3DProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const engine = new BABYLON.Engine(canvas, true, { stencil: true });
    engineRef.current = engine;

    const createScene = async () => {
      const scene = new BABYLON.Scene(engine);
      scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.05, 1);
      
      // Add debug layer (turned off by default)
      scene.debugLayer.isVisible = false;

      // Camera setup
      const camera = new BABYLON.ArcRotateCamera(
        "camera",
        Math.PI/2,
        Math.PI/3,
        10,
        new BABYLON.Vector3(0, 1, 0),
        scene
      );
      camera.attachControl(canvas, true);
      camera.wheelPrecision = 50;
      camera.lowerRadiusLimit = 2;
      camera.upperRadiusLimit = 20;

      // Lighting
      const light = new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(0, 1, 0),
        scene
      );
      light.intensity = 0.7;
      
      // Add directional light for better shadows
      const dirLight = new BABYLON.DirectionalLight(
        "dirLight", 
        new BABYLON.Vector3(-1, -2, -1), 
        scene
      );
      dirLight.intensity = 0.5;

      // Grid
      const gridSize = 20;
      const grid = BABYLON.MeshBuilder.CreateGround(
        "grid",
        { width: gridSize, height: gridSize, subdivisions: 20 },
        scene
      );
      const gridMaterial = new GridMaterial("gridMaterial", scene);
      gridMaterial.majorUnitFrequency = 5;
      gridMaterial.minorUnitVisibility = 0.3;
      gridMaterial.gridRatio = 1;
      gridMaterial.backFaceCulling = false;
      gridMaterial.mainColor = new BABYLON.Color3(0.2, 0.2, 0.2);
      gridMaterial.lineColor = new BABYLON.Color3(0.4, 0.4, 0.4);
      grid.material = gridMaterial;

      // Load URDF Robot
      try {
        console.log("Starting URDF robot loading...");
        await loadURDFRobot(scene, "urdf/T12/T12.URDF", "urdf/T12");
        console.log("URDF robot loading completed");
      } catch (error) {
        console.error("Error loading URDF:", error);
      }

      // Add Inspector key (press 'I' to show/hide)
      window.addEventListener('keydown', (ev) => {
        if (ev.key === 'i') {
          if (scene.debugLayer.isVisible()) {
            scene.debugLayer.hide();
          } else {
            scene.debugLayer.show();
          }
        }
      });

      if (onSceneReady) {
        onSceneReady(scene);
      }

      return scene;
    };

    let scene: BABYLON.Scene;
    createScene().then(createdScene => {
      scene = createdScene;
    });

    engine.runRenderLoop(() => {
      if (engineRef.current?.scenes[0]) {
        engineRef.current.scenes[0].render();
      }
    });

    const handleResize = () => {
      if (engineRef.current) {
        engineRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engineRef.current?.dispose();
    };
  }, [onSceneReady]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', outline: 'none' }}
    />
  );
};

export default Scene3D;
