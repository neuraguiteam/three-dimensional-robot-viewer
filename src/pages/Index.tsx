
import Scene3D from "../components/Scene3D";
import NavigationPanel from "../components/NavigationPanel";

const Index = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <NavigationPanel />
      <div className="flex-1 relative">
        <Scene3D />
      </div>
    </div>
  );
};

export default Index;
