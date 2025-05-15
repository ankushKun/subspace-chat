import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalState, useServerSync, useCachePersistence, useBackgroundPreload } from '@/hooks/global-state';
import ChannelList from '@/app/components/channel-list';
import DmList from '@/app/components/dm-list';
import Hero from '@/app/components/hero';
import Chat from '@/app/components/chat';
import ServerList from '@/app/components/server-list';
import { useEffect } from 'react';
import { uploadFileAndGetId } from '@/lib/ao';
import Profile from './components/profile';
import { useConnection } from '@arweave-wallet-kit/react';
import { useMobile } from '@/hooks';
import UsersList from './components/users-list';

export default function App() {
    const { connected } = useConnection();
    const isMobile = useMobile();
    const navigate = useNavigate();
    const { serverId, channelId, userId } = useParams();
    const {
        setActiveServerId,
        activeServerId,
        isLoadingServer,
        setActiveChannelId,
        showUsers
    } = useGlobalState();

    useEffect(() => {
        const t = setTimeout(() => {
            if (!connected) {
                navigate("/");
            }
        }, 200);
        return () => clearTimeout(t);
    }, [connected]);

    // Use hooks for server synchronization and cache persistence
    useServerSync();
    useCachePersistence();

    // Prefetch server data in the background when app starts
    useBackgroundPreload();

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

    if (isMobile) {
        return <div className='flex h-screen max-h-screen w-screen gap-2 p-2'>
            {!channelId ? <>
                <div className='w-16 bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                    <ServerList />
                </div>
                {/* channels / dm list */}
                <div className='w-full bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                    {activeServerId === null ? <DmList /> : <ChannelList />}
                    <Profile />
                </div>
            </> : <>
                <div className='w-full bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                    {showUsers ? <UsersList /> : <Chat />}
                </div>
            </>}
        </div>;
    }

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
            {activeServerId !== null && showUsers && <div className='min-w-[300px] bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                <UsersList />
            </div>}
        </div>
    )
}