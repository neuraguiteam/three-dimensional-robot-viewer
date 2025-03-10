
import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { setupScene } from '../utils/sceneSetup';
import { SceneConfig } from '../types/sceneTypes';

interface Scene3DProps {
  config?: SceneConfig;
  onSceneReady?: (scene: BABYLON.Scene) => void;
  onRender?: (scene: BABYLON.Scene) => void;
}

const Scene3D = ({ config, onSceneReady, onRender }: Scene3DProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const engine = new BABYLON.Engine(canvas, true);
    engineRef.current = engine;

    const scene = setupScene(canvas, config);

    if (onSceneReady) {
      onSceneReady(scene);
    }

    engine.runRenderLoop(() => {
      if (onRender) {
        onRender(scene);
      }
      scene.render();
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
  }, [config, onSceneReady, onRender]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', outline: 'none' }}
    />
  );
};

export default Scene3D;
