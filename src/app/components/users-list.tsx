import { useGlobalState } from "@/hooks/global-state";
import { useMobile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function UsersList() {
    const { activeServerId, showUsers, setShowUsers } = useGlobalState();
    const isMobile = useMobile();

    return (
        <div className="h-full w-full flex flex-col">
            {/* Users Header */}
            <div className="flex items-center gap-2 p-3 border-b border-border/30 h-14">
                {isMobile && <Button variant="ghost" size="icon" className="!p-0 -ml-1" onClick={() => setShowUsers(false)}>
                    <ArrowLeft size={20} className="!h-5 !w-5 text-muted-foreground" />
                </Button>}
                <span className="font-medium">Members</span>
            </div>

            {/* Users List Area */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">TODO!</p>
                </div>
            </div>
        </div>
    );
}