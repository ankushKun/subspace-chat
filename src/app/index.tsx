import { useParams } from 'react-router-dom';
import { useGlobalState, useServerSync, useCachePersistence } from '@/hooks/global-state';
import ChannelList from '@/app/components/channel-list';
import DmList from '@/app/components/dm-list';
import Hero from '@/app/components/hero';
import Chat from '@/app/components/chat';
import ServerList from '@/app/components/server-list';
import { useEffect } from 'react';
import { uploadFileAndGetId } from '@/lib/ao';
import Profile from './components/profile';

export default function App() {
    const { serverId, channelId, userId } = useParams();
    const {
        setActiveServerId,
        activeServerId,
        isLoadingServer,
        setActiveChannelId
    } = useGlobalState();

    // Use hooks for server synchronization and cache persistence
    useServerSync();
    useCachePersistence();

    useEffect(() => {
        console.log('URL params:', serverId, channelId, userId);

        // Set server ID from URL params
        setActiveServerId(serverId ? serverId : null);

        // Set channel ID from URL params if present
        if (channelId) {
            const channelIdNum = parseInt(channelId, 10);
            if (!isNaN(channelIdNum)) {
                setActiveChannelId(channelIdNum);
            }
        } else {
            // Clear active channel if not in URL
            setActiveChannelId(null);
        }
    }, [serverId, channelId, userId, setActiveServerId, setActiveChannelId]);

    return (
        <div className='flex h-screen max-h-screen w-screen gap-2 p-2'>
            <div className='w-16 bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                <ServerList />
            </div>
            {/* channels / dm list */}
            <div className='w-[333px] max-w-[333px] min-w-[333px] bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                {activeServerId === null ? <DmList /> : <ChannelList />}
                <Profile />
            </div>
            {/* main view */}
            <div className='w-full bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2'>
                {activeServerId === null ? <Hero /> : <Chat />}
            </div>
            {activeServerId !== null && <div className='w-80 bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                <div>users</div>
            </div>}
        </div>
    )
}