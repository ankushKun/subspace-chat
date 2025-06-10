import { useProfile } from "@/hooks/subspace"
import { useWallet } from "@/hooks/use-wallet"
import { shortenAddress } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { UserCheck, UserPlus, Clock, X, Check, Loader2, MoreVertical, UserMinus2Icon, MessageCircleIcon } from "lucide-react"
import { useState, useMemo, useCallback, memo } from "react"
import { toast } from "sonner"
import useSubspace from "@/hooks/subspace"
import type { Friend } from "@/types/subspace"
import InboxComponent from "@/components/inbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function FriendList() {
    const { profiles, actions: profileActions } = useProfile()
    const { address } = useWallet()
    const subspace = useSubspace()
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const currentUserProfile = address ? profiles[address] : null
    const friends = currentUserProfile?.friends || []

    // Helper function to get the other user's ID from a friendship
    const getOtherUserId = useCallback((friend: Friend, currentUserId: string) => {
        return friend.userId1 === currentUserId ? friend.userId2 : friend.userId1
    }, [])

    // Memoized filtered friends by status
    const { confirmedFriends, pendingRequestsSent, pendingRequestsReceived } = useMemo(() => {
        if (!address) {
            return { confirmedFriends: [], pendingRequestsSent: [], pendingRequestsReceived: [] }
        }

        return {
            confirmedFriends: friends.filter(friend =>
                friend.user1Accepted === 1 && friend.user2Accepted === 1
            ),
            pendingRequestsSent: friends.filter(friend =>
                friend.userId1 === address && friend.user2Accepted === 0
            ),
            pendingRequestsReceived: friends.filter(friend =>
                friend.userId2 === address && friend.user2Accepted === 0
            )
        }
    }, [friends, address])

    // Handle accepting friend request
    const handleAcceptRequest = useCallback(async (friendId: string) => {
        if (!address) return

        setActionLoading(friendId)
        try {
            const success = await subspace.user.acceptFriendRequest({ friendId })
            if (success) {
                toast.success("Friend request accepted!")
                // Refresh both users' profiles to get updated friends data
                const [currentUserProfile, friendProfile] = await Promise.all([
                    subspace.user.getProfile({ userId: address }),
                    subspace.user.getProfile({ userId: friendId })
                ])

                if (currentUserProfile) {
                    profileActions.updateProfile(address, currentUserProfile)
                }
                if (friendProfile) {
                    profileActions.updateProfile(friendId, friendProfile)
                }
            } else {
                toast.error("Failed to accept friend request")
            }
        } catch (error) {
            console.error("Error accepting friend request:", error)
            toast.error("Failed to accept friend request")
        } finally {
            setActionLoading(null)
        }
    }, [address, subspace.user, profileActions])

    // Handle rejecting friend request
    const handleRejectRequest = useCallback(async (friendId: string) => {
        if (!address) return

        setActionLoading(friendId)
        try {
            const success = await subspace.user.rejectFriendRequest({ friendId })
            if (success) {
                toast.success("Friend request rejected")
                // Refresh both users' profiles to get updated friends data
                const [currentUserProfile, friendProfile] = await Promise.all([
                    subspace.user.getProfile({ userId: address }),
                    subspace.user.getProfile({ userId: friendId })
                ])

                if (currentUserProfile) {
                    profileActions.updateProfile(address, currentUserProfile)
                }
                if (friendProfile) {
                    profileActions.updateProfile(friendId, friendProfile)
                }
            } else {
                toast.error("Failed to reject friend request")
            }
        } catch (error) {
            console.error("Error rejecting friend request:", error)
            toast.error("Failed to reject friend request")
        } finally {
            setActionLoading(null)
        }
    }, [address, subspace.user, profileActions])

    // Handle removing friend
    const handleRemoveFriend = useCallback(async (friendId: string) => {
        if (!address) return

        setActionLoading(friendId)
        try {
            const success = await subspace.user.removeFriend({ friendId })
            if (success) {
                toast.success("Friend removed")
                // Refresh both users' profiles to get updated friends data
                const [currentUserProfile, friendProfile] = await Promise.all([
                    subspace.user.getProfile({ userId: address }),
                    subspace.user.getProfile({ userId: friendId })
                ])

                if (currentUserProfile) {
                    profileActions.updateProfile(address, currentUserProfile)
                }
                if (friendProfile) {
                    profileActions.updateProfile(friendId, friendProfile)
                }
            } else {
                toast.error("Failed to remove friend")
            }
        } catch (error) {
            console.error("Error removing friend:", error)
            toast.error("Failed to remove friend")
        } finally {
            setActionLoading(null)
        }
    }, [address, subspace.user, profileActions])

    // Memoized Friend item component
    const FriendItem = useCallback(({ userId, showActions = false, actionType = 'none' }: {
        userId: string,
        showActions?: boolean,
        actionType?: 'accept' | 'remove' | 'none'
    }) => {
        const friendProfile = profiles[userId]
        const displayName = friendProfile?.primaryName || shortenAddress(userId)

        return (
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    {friendProfile?.pfp ? (
                        <img
                            src={`https://arweave.net/${friendProfile.pfp}`}
                            alt={displayName}
                            className="w-8 h-8 rounded-full bg-muted"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-sm font-medium text-muted-foreground">
                                {displayName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{displayName}</div>
                    {friendProfile?.primaryName && (
                        <div className="text-xs text-muted-foreground truncate">
                            {shortenAddress(userId)}
                        </div>
                    )}
                </div>

                {/* Actions */}
                {showActions && (
                    <div className="flex items-center gap-2">
                        {actionType === 'accept' && (
                            <>
                                <Button
                                    variant="outline"
                                    className="h-8 items-center justify-center bg-background hover:!bg-green-400/20 transition-colors"
                                    onClick={() => handleAcceptRequest(userId)}
                                    disabled={actionLoading === userId}
                                >
                                    Accept
                                    {actionLoading === userId ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    ) : (
                                        <Check className="w-4 h-4 stroke-green-500 transition-colors" />
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-8 items-center justify-center bg-background hover:!bg-red-400/20 transition-colors"
                                    onClick={() => handleRejectRequest(userId)}
                                    disabled={actionLoading === userId}
                                >
                                    Cancel
                                    <X className="w-4 h-4 stroke-red-500 transition-colors" />
                                </Button>
                            </>
                        )}
                        {actionType == "remove" && <>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 items-center justify-center bg-background"
                                    >
                                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-2 text-sm flex flex-col gap-2 bg-background w-fit" side="bottom" align="end">

                                    <Button
                                        variant="ghost"
                                        className="h-8 items-center justify-start bg-background hover:!bg-primary/20 transition-colors"
                                        disabled={actionLoading === userId}
                                    >
                                        <MessageCircleIcon className="w-4 h-4" />
                                        Send DM
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="h-8 items-center justify-start bg-background text-destructive hover:!bg-destructive/20 transition-colors"
                                        onClick={() => handleRemoveFriend(userId)}
                                        disabled={actionLoading === userId}
                                    >
                                        {actionLoading === userId ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        ) : (
                                            <UserMinus2Icon className="w-4 h-4" />
                                        )}
                                        Remove Friend
                                    </Button>

                                </PopoverContent>
                            </Popover>
                        </>}
                        {/* {actionType === 'remove' && (
                        )} */}
                    </div>
                )}
            </div>
        )
    }, [profiles, actionLoading, handleAcceptRequest, handleRejectRequest, handleRemoveFriend])

    if (!address) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-4">
                <UserPlus className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                    Connect your wallet to view friends
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto relative">
            <InboxComponent className="absolute top-4 right-4" />
            {/* Pending Requests Received */}
            {pendingRequestsReceived.length > 0 && (
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">Friend Requests</h3>
                        <Badge variant="secondary" className="text-xs">
                            {pendingRequestsReceived.length}
                        </Badge>
                    </div>
                    <div className="space-y-1">
                        {pendingRequestsReceived.map((friend) => {
                            const friendId = getOtherUserId(friend, address)
                            return (
                                <FriendItem
                                    key={`${friend.userId1}-${friend.userId2}`}
                                    userId={friendId}
                                    showActions={true}
                                    actionType="accept"
                                />
                            )
                        })}
                    </div>
                    <Separator className="mt-4" />
                </div>
            )}

            {/* Friends List */}
            <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <UserCheck className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Friends</h3>
                    {confirmedFriends.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                            {confirmedFriends.length}
                        </Badge>
                    )}
                </div>

                {confirmedFriends.length > 0 ? (
                    <div className="space-y-1">
                        {confirmedFriends.map((friend) => {
                            const friendId = getOtherUserId(friend, address)
                            return (
                                <FriendItem
                                    key={`${friend.userId1}-${friend.userId2}`}
                                    userId={friendId}
                                    showActions={true}
                                    actionType="remove"
                                />
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground mb-2">No friends yet</p>
                        <p className="text-xs text-muted-foreground">
                            Send friend requests to other users to get started!
                        </p>
                    </div>
                )}
            </div>

            {/* Pending Requests Sent */}
            {pendingRequestsSent.length > 0 && (
                <>
                    <Separator />
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <h3 className="font-semibold text-sm">Pending Requests</h3>
                            <Badge variant="secondary" className="text-xs">
                                {pendingRequestsSent.length}
                            </Badge>
                        </div>
                        <div className="space-y-1">
                            {pendingRequestsSent.map((friend) => {
                                const friendId = getOtherUserId(friend, address)
                                return (
                                    <FriendItem
                                        key={`${friend.userId1}-${friend.userId2}`}
                                        userId={friendId}
                                        showActions={false}
                                    />
                                )
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export default memo(FriendList)