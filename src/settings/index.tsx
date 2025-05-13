import { useState } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
    const navigate = useNavigate()
    const [activePage, setActivePage] = useState('My Account')

    const handleClose = () => {
        navigate('/app')
    }

    return (
        <div>Settings</div>
    )
}