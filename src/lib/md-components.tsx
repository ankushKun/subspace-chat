import React from "react";
import type { Components } from "react-markdown";
import { cn } from "./utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import UserMention from "@/components/user-mention";
import ChannelMention from "@/components/channel-mention";
import { ServerInviteEmbed } from "@/components/server-invite-embed";
import { OpenGraphEmbed } from "@/components/open-graph-embed";
import { LinkWarningDialog } from "@/components/link-warning-dialog";

// Global store for mentions data (temporary solution)
let currentMentions: { type: 'user' | 'channel'; display: string; id: string; }[] = [];

export const setCurrentMentions = (mentions: { type: 'user' | 'channel'; display: string; id: string; }[]) => {
    currentMentions = mentions;
};

// Create a context for join server dialog
interface JoinServerDialogContextType {
    openJoinDialog: (inviteLink: string) => void;
}

export const JoinServerDialogContext = React.createContext<JoinServerDialogContextType | null>(null);

// Function to detect if a URL is a Subspace invite link
const isSubspaceInviteLink = (url: string): boolean => {
    if (!url) return false;

    // console.log('Checking if URL is Subspace invite link:', url);

    // Handle both with and without protocol
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    // console.log('Normalized URL:', normalizedUrl);

    try {
        const urlObj = new URL(normalizedUrl);
        // console.log('URL hostname:', urlObj.hostname);
        // console.log('URL hash:', urlObj.hash);

        // Check if it's a subspace.ar.io domain with an invite path
        const isSubspaceDomain = (urlObj.hostname === 'subspace.ar.io' || urlObj.hostname === 'www.subspace.ar.io');
        const hasInviteHash = urlObj.hash.startsWith('#/invite/');

        // console.log('Is Subspace domain:', isSubspaceDomain);
        // console.log('Has invite hash:', hasInviteHash);

        return isSubspaceDomain && hasInviteHash;
    } catch (error) {
        console.log('Error parsing URL:', error);
        return false;
    }
};

export const mdComponents: Components = {
    a: ({ node, ...props }) => {
        const href = props.href;
        const children = props.children;
        const joinDialogContext = React.useContext(JoinServerDialogContext);

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

        // Handle Subspace invite links
        if (href && isSubspaceInviteLink(href)) {
            // console.log('Rendering Subspace invite link:', href);
            return (
                <div className="mt-2 w-fit">
                    {/* Clickable link */}
                    <span
                        className="text-blue-500 hover:underline cursor-pointer whitespace-normal overflow-hidden"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Subspace invite link clicked:', href);
                            console.log('JoinDialogContext:', joinDialogContext);
                            if (joinDialogContext) {
                                console.log('Calling openJoinDialog with:', href);
                                joinDialogContext.openJoinDialog(href);
                            } else {
                                console.error('JoinServerDialogContext not found - context is null');
                            }
                        }}
                    >
                        {children}
                    </span>

                    {/* Server invite embed */}
                    <ServerInviteEmbed inviteUrl={href} />
                </div>
            );
        }

        // Handle regular links with security dialog
        return (
            <div className="my-2 w-full overflow-hidden">
                {/* Clickable link with security dialog */}
                <LinkWarningDialog
                    href={href}
                    triggerClassName={cn(props.className, "text-blue-500 hover:underline cursor-pointer")}
                >
                    {children}
                </LinkWarningDialog>

                {/* Open Graph embed */}
                <OpenGraphEmbed url={href} />
            </div>
        )
    },
};