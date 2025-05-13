import { useGlobalState } from "@/hooks/global-state";
import { ChevronDown, Loader2 } from "lucide-react";
import type { Server } from "@/lib/types";

export default function ChannelList() {
    const { activeServer } = useGlobalState();

    return (
        <div className='w-full select-none border-b border-border/70 hover:bg-accent/40 rounded-t-lg p-3 px-4 flex items-center justify-between'>
            <div>{activeServer?.name || <Loader2 className='w-4 h-4 animate-spin' />}</div>
            <ChevronDown className='w-4 h-4' />
        </div>
    )
}