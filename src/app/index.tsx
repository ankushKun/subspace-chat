import { useParams } from 'react-router-dom';

export default function App() {
    const { serverId, channelId } = useParams();
    console.log(serverId, channelId);
    return (
        <div>
            Server: {serverId}<br />
            Channel: {channelId}
        </div>
    )
}