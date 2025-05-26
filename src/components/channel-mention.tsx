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
            className="font-medium text-white cursor-pointer px-0.5 bg-primary/80 hover:bg-primary/60 transition-colors duration-200 w-fit rounded-sm p-0"
            onClick={handleClick}
        >
            {renderer(displayText)}
        </div>
    )
} 