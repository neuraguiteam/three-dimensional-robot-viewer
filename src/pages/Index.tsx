
import { useCallback } from "react";
import Scene3D from "../components/Scene3D";
import NavigationPanel from "../components/NavigationPanel";
import { loadURDFRobot } from "../utils/urdfLoader";
import * as BABYLON from '@babylonjs/core';

const Index = () => {
  const handleSceneReady = useCallback(async (scene: BABYLON.Scene) => {
    try {
      await loadURDFRobot(scene, "urdf/T12/T12.URDF", "urdf/T12/");
    } catch (error) {
      console.error("Error loading URDF:", error);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <NavigationPanel />
      <div className="flex-1 relative">
        <Scene3D 
          config={{
            clearColor: new BABYLON.Color4(0.05, 0.05, 0.05, 1),
            gridConfig: {
              size: 20,
              subdivisions: 20,
              majorUnitFrequency: 5,
              minorUnitVisibility: 0.3,
            }
          }}
          onSceneReady={handleSceneReady}
        />
      </div>
    </div>
  );
};

export default Index;
