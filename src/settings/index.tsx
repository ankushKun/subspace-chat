import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useConnection } from '@arweave-wallet-kit/react'

export default function Settings() {
    const navigate = useNavigate()
    const { connected } = useConnection();

    useEffect(() => {
        const t = setTimeout(() => {
            if (!connected) {
                console.log("not connected, redirecting to landing")
                navigate("/");
            }
        }, 200);
        return () => clearTimeout(t);
    }, [connected]);

    const handleClose = () => {
        navigate('/app')
    }

    return (
        <div>Settings</div>
    )
}