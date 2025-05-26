import { useServer } from "@/hooks/subspace/server"
import { useProfile } from "@/hooks/subspace"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Crown, Users, Search, MoreHorizontal, UserPlus, Settings, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ServerMember } from "@/types/subspace"
import UserMention from "@/components/user-mention"

const MemberAvatar = ({
    userId,
    size = "sm"
}: {
    userId: string;
    size?: "xs" | "sm" | "md";
}) => {
    const { profiles } = useProfile()
    const profile = profiles[userId]

    const sizeClasses = {
        xs: "w-6 h-6",
        sm: "w-8 h-8",
        md: "w-10 h-10"
    }

    return (
        <div className="relative flex-shrink-0">
            <div className={cn(
                "relative rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center",
                sizeClasses[size]
            )}>
                {profile?.pfp ? (
                    <img
                        src={`https://arweave.net/${profile.pfp}`}
                        alt={profile.username || userId}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="text-primary font-semibold text-xs">
                        {(profile?.username || userId).charAt(0).toUpperCase()}
                    </span>
                )}
            </div>
        </div>
    )
}

const MemberItem = ({
    member,
    isOwner = false,
    onClick
}: {
    member: ServerMember;
    isOwner?: boolean;
    onClick?: () => void;
}) => {
    const { profiles } = useProfile()
    const profile = profiles[member.userId]
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div className="relative group">
            <UserMention userId={member.userId} side="left" align="start" renderer={(displayName) =>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "w-full h-10 px-2 justify-start text-sm transition-all duration-200 relative overflow-hidden",
                        "hover:bg-muted/50 rounded-md",
                        "text-muted-foreground hover:text-foreground",
                        "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                    )}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <div className="flex items-center gap-3 w-full relative z-10">
                        {/* Avatar */}
                        <MemberAvatar userId={member.userId} size="sm" />

                        {/* Member info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium truncate transition-colors text-foreground">
                                    {displayName}
                                </span>

                                {/* Owner indicator */}
                                {isOwner && (
                                    <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                                )}
                            </div>
                        </div>

                        {/* Actions on hover */}
                        {isHovered && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    console.log('Member actions for:', displayName)
                                }}
                            >
                                <MoreHorizontal className="w-3 h-3" />
                            </Button>
                        )}
                    </div>
                </Button>
            } />
        </div>
    )
}

const MemberSection = ({
    title,
    members,
    isExpanded,
    onToggle,
    isOwnerSection = false
}: {
    title: string;
    members: ServerMember[];
    isExpanded: boolean;
    onToggle: () => void;
    isOwnerSection?: boolean;
}) => {
    const { servers, activeServerId } = useServer()
    const server = activeServerId ? servers[activeServerId] : null

    const memberCount = members.length

    return (
        <div className="mb-3">
            {/* Section header */}
            <Button
                variant="ghost"
                size="sm"
                className={cn(
                    "w-full h-7 px-2 justify-start text-xs font-semibold uppercase tracking-wider transition-all duration-200",
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-muted/50 rounded-md"
                )}
                onClick={onToggle}
            >
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        {isExpanded ? (
                            <ChevronDown className="w-3 h-3 transition-transform duration-200" />
                        ) : (
                            <ChevronRight className="w-3 h-3 transition-transform duration-200" />
                        )}
                        <span className="truncate">{title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground/60">{memberCount}</span>
                </div>
            </Button>

            {/* Members list */}
            {isExpanded && (
                <div className="mt-1 space-y-0.5">
                    {members.map((member) => (
                        <MemberItem
                            key={member.userId}
                            member={member}
                            isOwner={isOwnerSection || member.userId === server?.owner}
                            onClick={() => console.log('Open member profile:', member.userId)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default function MemberList(props: React.HTMLAttributes<HTMLDivElement>) {
    const { activeServerId, servers } = useServer()
    const [searchQuery, setSearchQuery] = useState("")
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["owner", "members"]))

    const server = activeServerId ? servers[activeServerId] : null
    const serverMembers = Array.isArray(server?.members) ? server.members : []

    // Filter members based on search query
    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return serverMembers

        return serverMembers.filter(member => {
            const displayName = member.nickname || member.userId
            return displayName.toLowerCase().includes(searchQuery.toLowerCase())
        })
    }, [serverMembers, searchQuery])

    // Organize members into owner and regular members
    const organizedMembers = useMemo(() => {
        const ownerMembers: ServerMember[] = []
        const regularMembers: ServerMember[] = []

        // Ensure filteredMembers is an array before calling forEach
        if (Array.isArray(filteredMembers)) {
            filteredMembers.forEach(member => {
                if (member.userId === server?.owner) {
                    ownerMembers.push(member)
                } else {
                    regularMembers.push(member)
                }
            })
        }

        return { owner: ownerMembers, members: regularMembers }
    }, [filteredMembers, server?.owner])

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev)
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId)
            } else {
                newSet.add(sectionId)
            }
            return newSet
        })
    }

    if (!server) {
        return (
            <div
                {...props}
                className={cn(
                    "flex flex-col w-60 h-full py-4 px-3",
                    "bg-gradient-to-b from-background via-background/95 to-background/90",
                    "border-l border-border/50 backdrop-blur-sm",
                    props.className
                )}
            >
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No server selected</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            {...props}
            className={cn(
                "flex flex-col w-60 h-full relative",
                "bg-gradient-to-b from-background via-background/95 to-background/90",
                "border-l border-border/50 backdrop-blur-sm",
                "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40",
                // Subtle pattern overlay
                "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_50%)] before:pointer-events-none",
                props.className
            )}
        >
            {/* Ambient glow at top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-primary/5 rounded-full blur-2xl" />

            {/* Header */}
            <div className="mb-4 p-4 flex flex-col justify-center items-start relative">
                <div className="flex items-center gap-2 w-full">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">
                        Members
                    </h2>
                    <span className="text-sm text-muted-foreground ml-auto">
                        {server.member_count || serverMembers.length}
                    </span>
                </div>
                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-border to-transparent absolute bottom-0" />
            </div>

            {/* Search */}
            <div className="px-4 mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <Input
                        placeholder="Search members"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={cn(
                            "pl-9 h-8 bg-muted/30 border-border/50 focus:border-primary/50",
                            "placeholder:text-muted-foreground/60 text-sm",
                            "focus-visible:ring-1 focus-visible:ring-primary/20"
                        )}
                    />
                </div>
            </div>

            {/* Members list */}
            <div className="flex-1 overflow-y-auto space-y-1 px-2">
                {!Array.isArray(filteredMembers) || filteredMembers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                        <Users className="w-8 h-8 text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">
                            {searchQuery ? "No members found" : "No members"}
                        </p>
                        {searchQuery && (
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Try a different search term
                            </p>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Owner section */}
                        {organizedMembers.owner.length > 0 && (
                            <MemberSection
                                title="Owner"
                                members={organizedMembers.owner}
                                isExpanded={expandedSections.has("owner")}
                                onToggle={() => toggleSection("owner")}
                                isOwnerSection={true}
                            />
                        )}

                        {/* Members section */}
                        {organizedMembers.members.length > 0 && (
                            <MemberSection
                                title="Members"
                                members={organizedMembers.members}
                                isExpanded={expandedSections.has("members")}
                                onToggle={() => toggleSection("members")}
                                isOwnerSection={false}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Ambient glow at bottom */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-12 bg-primary/3 rounded-full blur-xl" />
        </div>
    )
}