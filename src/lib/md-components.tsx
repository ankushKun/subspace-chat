import type { Components } from "react-markdown";
import { cn } from "./utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import UserMention from "@/components/user-mention";
import ChannelMention from "@/components/channel-mention";

// Global store for mentions data (temporary solution)
let currentMentions: { type: 'user' | 'channel'; display: string; id: string; }[] = [];

export const setCurrentMentions = (mentions: { type: 'user' | 'channel'; display: string; id: string; }[]) => {
    currentMentions = mentions;
};

export const mdComponents: Components = {
    a: ({ node, ...props }) => {
        const href = props.href;
        const children = props.children;

        // Handle user mention placeholders
        if (href?.startsWith('#__user_mention_')) {
            const index = parseInt(href.replace('#__user_mention_', '').replace('__', ''));
            const mention = currentMentions[index];
            if (!mention) return <>{children}</>;

            return <UserMention userId={mention.id} side="bottom" align="start" showAt={true}
                renderer={(text) => <span className="inline-flex items-center px-1 py-0.5 mx-0.5 text-sm font-medium text-primary bg-primary/20 hover:bg-primary/30 transition-colors duration-150 rounded cursor-pointer">
                    @{text}
                </span>} />
        }

        // Handle channel mention placeholders
        if (href?.startsWith('#__channel_mention_')) {
            const index = parseInt(href.replace('#__channel_mention_', '').replace('__', ''));
            const mention = currentMentions[index];
            if (!mention) return <>{children}</>;

            return <ChannelMention channelId={mention.id} showHash={true}
                renderer={(text) => <span className="inline-flex items-center px-1 py-0.5 mx-0.5 text-sm font-medium text-primary bg-primary/20 hover:bg-primary/30 transition-colors duration-150 rounded cursor-pointer">
                    #{text}
                </span>} />
        }

        // Handle regular links with security dialog
        return <Dialog>
            <DialogTrigger asChild>
                <a
                    {...props}
                    href={undefined}
                    className={cn(props.className, "text-blue-500 hover:underline cursor-pointer")}
                />
            </DialogTrigger>
            <DialogContent className="">
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold break-words">Hol' Up!</h3>
                    <p>You are about to open a link sent by someone on Subspace. It may be malicious or contain malware. Check all links before opening it.</p>
                    <div className="space-y-2">
                        <p><strong>Text:</strong> <span className="font-mono break-all">{props.children}</span></p>
                        <p><strong>URL:</strong> <span className="font-mono break-all text-sm text-blue-500">{props.href}</span></p>
                    </div>
                    <div className="flex gap-2">
                        <a
                            href={props.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                        >
                            Open Link
                        </a>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    },
}