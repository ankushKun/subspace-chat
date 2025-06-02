import { useServer } from "@/hooks/subspace"

export default function ChannelMention({ channelId, showHash = true, renderer }: { channelId: string; showHash?: boolean, renderer: (text: string) => React.ReactNode }) {
    const { activeServerId, servers, actions } = useServer()

    const server = activeServerId ? servers[activeServerId] : null
    const channel = server?.channels.find(c => c.channelId.toString() === channelId)

    const displayText = channel?.name || `channel-${channelId}`

    const handleClick = () => {
        if (channel && activeServerId) {
            actions.setActiveChannelId(channel.channelId)
        }
    }

    return (
        <div
            className="inline-flex items-center px-1 py-0.5 mx-0.5 text-sm font-medium text-primary bg-primary/20 hover:bg-primary/30 transition-colors duration-150 rounded-sm cursor-pointer"
            onClick={handleClick}
        >
            {renderer(displayText)}
        </div>
    )
} 