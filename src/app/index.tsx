import TextWLine from '@/components/text-w-line';
import { Button } from '@/components/ui/button';
import { ChevronDown, Home, Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

const ServerIcon = ({ id, onClick }: { id: string, onClick?: () => void }) => {
    const [hover, setHover] = useState(false);
    const activeId = "2"

    const handleMouseEnter = () => {
        console.log('mouse enter');
        setHover(true);
    }

    const handleMouseLeave = () => {
        console.log('mouse leave');
        setHover(false);
    }

    return (
        <Button className='w-12 h-12 p-0 rounded-lg relative' onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={onClick}>
            <div data-visible={hover || activeId === id} data-expand={activeId === id} className='w-[2px] absolute -left-2 z-10 bg-foreground rounded-r transition-all duration-100 h-2 data-[expand=true]:h-6 data-[visible=true]:opacity-100 data-[visible=false]:opacity-0' />
            <img src='https://arweave.net/W11lwYHNY5Ag2GsNXvn_PF9qEnqZ8c_Qgp7RqulbyE4' className='w-full h-full object-cover rounded-lg' />
        </Button>
    )
}

export default function App() {
    const { serverId, channelId, userId } = useParams();
    const [activeServer, setActiveServer] = useState(serverId);

    console.log(serverId, channelId, userId);
    return (
        <div className='flex h-screen max-h-screen w-screen gap-2 p-2'>
            <div className='w-16 bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                <Button variant='outline' size='icon' className='w-10 h-10 rounded-lg'>
                    <Home />
                </Button>
                <TextWLine className='w-6 opacity-70' />
                <ServerIcon id='1' onClick={() => setActiveServer('1')} />
                <ServerIcon id='2' onClick={() => setActiveServer('2')} />
                <ServerIcon id='3' onClick={() => setActiveServer('3')} />
                <ServerIcon id='4' onClick={() => setActiveServer('4')} />
                <ServerIcon id='5' onClick={() => setActiveServer('5')} />
                {/* add server button */}
                <Button variant='outline' size='icon' className='w-10 h-10 rounded-lg mt-auto'>
                    <Plus />
                </Button>
            </div>
            {/* channels / dm list */}
            <div className='w-[496px] bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                <div className='w-full select-none border-b border-border/70 hover:bg-accent/40 rounded-t-lg p-3 px-4 flex items-center justify-between'>
                    <div>Subspace Chat</div>
                    <ChevronDown className='w-4 h-4' />
                </div>
            </div>
            {/* main view */}
            <div className='w-full bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                <div>chats</div>
            </div>
            <div className='w-80 bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                <div>users</div>
            </div>
        </div>
    )
}