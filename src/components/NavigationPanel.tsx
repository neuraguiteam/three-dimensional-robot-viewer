
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings, Home, Move, Tool } from "lucide-react";

const NavigationPanel = () => {
  const navItems = [
    { icon: Home, label: "Overview" },
    { icon: Move, label: "Motion" },
    { icon: Tool, label: "Tools" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <Card className="h-full w-16 bg-sidebar/80 backdrop-blur-md border-r border-white/10">
      <div className="flex flex-col items-center py-4 gap-6">
        {navItems.map((item, index) => (
          <div key={item.label} className="w-full">
            <button
              className="w-full flex flex-col items-center gap-1 px-2 py-2 text-muted-foreground hover:text-primary transition-colors"
              title={item.label}
            >
              <item.icon size={20} />
            </button>
            {index < navItems.length - 1 && (
              <Separator className="my-2 bg-white/10" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default NavigationPanel;
