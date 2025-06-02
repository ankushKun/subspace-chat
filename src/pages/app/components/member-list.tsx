import { useServer } from "@/hooks/subspace/server"
import { useProfile } from "@/hooks/subspace"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Crown, Users, Search, MoreHorizontal, UserPlus, Settings, ChevronDown, ChevronRight, UsersRound } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ServerMember, Role } from "@/types/subspace"
import UserMention from "@/components/user-mention"
import { useIsMobile } from "@/hooks/use-mobile"

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
                        alt={userId}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="text-primary font-semibold text-xs">
                        {(profile?.primaryName || userId).charAt(0).toUpperCase()}
                    </span>
                )}
            </div>
        </div>
    )
}

const MemberItem = ({
    member,
    isOwner = false,
    roleColor,
    onClick
}: {
    member: ServerMember;
    isOwner?: boolean;
    roleColor?: string;
    onClick?: () => void;
}) => {
    const { profiles } = useProfile()
    const profile = profiles[member.userId]
    const [isHovered, setIsHovered] = useState(false)
    const isMobile = useIsMobile()

    return (
        <div className="relative group">
            <UserMention userId={member.userId} side={isMobile ? "bottom" : "left"} align="start" renderer={(displayName) =>
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
                                <span
                                    className="font-medium truncate transition-colors"
                                    style={{
                                        color: roleColor || undefined
                                    }}
                                >
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
    isOwnerSection = false,
    roleColor,
    server
}: {
    title: string;
    members: ServerMember[];
    isOwnerSection?: boolean;
    roleColor?: string;
    server?: any;
}) => {
    const memberCount = members.length

    return (
        <div className="mb-3">
            {/* Section header */}
            <div
                className={cn(
                    "w-full h-7 px-2 flex items-center text-xs font-semibold uppercase tracking-wider",
                    "text-muted-foreground"
                )}
            >
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <span className="truncate">{title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground/60">{memberCount}</span>
                </div>
            </div>

            {/* Members list - always visible */}
            <div className="mt-1 space-y-0.5">
                {members.map((member) => (
                    <MemberItem
                        key={member.userId}
                        member={member}
                        isOwner={isOwnerSection || member.userId === server?.owner}
                        roleColor={roleColor}
                        onClick={() => console.log('Open member profile:', member.userId)}
                    />
                ))}
            </div>
        </div>
    )
}

export default function MemberList(props: React.HTMLAttributes<HTMLDivElement>) {
    const { activeServerId, servers } = useServer()
    const { profiles } = useProfile()
    const [searchQuery, setSearchQuery] = useState("")

    const server = activeServerId ? servers[activeServerId] : null
    const serverMembers = Array.isArray(server?.members) ? server.members : []
    const serverRoles = Array.isArray(server?.roles) ? server.roles : []

    // Filter members based on search query
    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return serverMembers

        return serverMembers.filter(member => {
            const displayName = member.nickname || member.userId
            const profile = profiles[member.userId]
            const primaryName = profile?.primaryName
            const lowerQuery = searchQuery.toLowerCase()

            return displayName.toLowerCase().includes(lowerQuery) ||
                member.userId.toLowerCase().includes(lowerQuery) ||
                (primaryName && primaryName.toLowerCase().includes(lowerQuery))
        })
    }, [serverMembers, searchQuery, profiles])

    // Get member's highest priority role (lowest orderId)
    const getMemberHighestRole = (member: ServerMember): Role | null => {
        if (!member.roles || !Array.isArray(member.roles) || member.roles.length === 0) {
            return null
        }

        const memberRoles = serverRoles
            .filter(role => member.roles.includes(role.roleId))
            .sort((a, b) => a.orderId - b.orderId)

        return memberRoles[0] || null
    }

    // Organize members by roles based on role order
    const organizedMembersByRole = useMemo(() => {
        const roleGroups: Record<string, { role: Role | null; members: ServerMember[] }> = {}

        // Initialize with all roles
        serverRoles.forEach(role => {
            roleGroups[`role-${role.roleId}`] = { role, members: [] }
        })

        // Add "No Role" section for members without roles
        roleGroups['no-role'] = { role: null, members: [] }

        // Organize members by their highest priority role
        if (Array.isArray(filteredMembers)) {
            filteredMembers.forEach(member => {
                const highestRole = getMemberHighestRole(member)

                if (highestRole) {
                    const key = `role-${highestRole.roleId}`
                    if (roleGroups[key]) {
                        roleGroups[key].members.push(member)
                    }
                } else {
                    roleGroups['no-role'].members.push(member)
                }
            })
        }

        // Sort members within each role group
        Object.values(roleGroups).forEach(group => {
            group.members.sort((a, b) => {
                const profileA = profiles[a.userId]
                const profileB = profiles[b.userId]

                const hasNameA = !!(a.nickname || profileA?.primaryName)
                const hasNameB = !!(b.nickname || profileB?.primaryName)

                const defaultPfpHash = "4mDPmblDGphIFa3r4tfE_o26m0PtfLftlzqscnx-ASo"
                const hasCustomPfpA = !!(profileA?.pfp && profileA.pfp !== defaultPfpHash)
                const hasCustomPfpB = !!(profileB?.pfp && profileB.pfp !== defaultPfpHash)

                // Calculate priority scores (higher is better)
                const scoreA = (hasNameA ? 2 : 0) + (hasCustomPfpA ? 2 : 0)
                const scoreB = (hasNameB ? 2 : 0) + (hasCustomPfpB ? 2 : 0)

                // Sort by priority score first
                if (scoreA !== scoreB) {
                    return scoreB - scoreA // Higher scores first
                }

                // If same priority, sort alphabetically by display name
                const displayNameA = a.nickname || profileA?.primaryName || a.userId
                const displayNameB = b.nickname || profileB?.primaryName || b.userId

                return displayNameA.toLowerCase().localeCompare(displayNameB.toLowerCase())
            })
        })

        return roleGroups
    }, [filteredMembers, serverRoles, profiles])

    // Sort role groups by role order (and owner first if exists)
    const sortedRoleGroups = useMemo(() => {
        const groups = Object.entries(organizedMembersByRole)
            .filter(([key, group]) => group.members.length > 0)
            .sort(([keyA, groupA], [keyB, groupB]) => {
                // Owner section always first
                if (keyA === 'owner') return -1
                if (keyB === 'owner') return 1

                // No role section always last
                if (keyA === 'no-role') return 1
                if (keyB === 'no-role') return -1

                // Sort by role order
                const roleA = groupA.role
                const roleB = groupB.role

                if (!roleA || !roleB) return 0
                return roleA.orderId - roleB.orderId
            })

        return groups
    }, [organizedMembersByRole])

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
                    <UsersRound className="w-5 h-5 text-muted-foreground" />
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

            {/* Members list organized by roles */}
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
                        {sortedRoleGroups.map(([key, group]) => {
                            const sectionTitle = group.role ? group.role.name : "No Role"
                            const isOwnerSection = key === 'owner'

                            return (
                                <MemberSection
                                    key={key}
                                    title={sectionTitle}
                                    members={group.members}
                                    isOwnerSection={isOwnerSection}
                                    roleColor={group.role?.color}
                                    server={server}
                                />
                            )
                        })}
                    </>
                )}
            </div>

            {/* Ambient glow at bottom */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-12 bg-primary/3 rounded-full blur-xl" />
        </div>
    )
}