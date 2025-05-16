import NotificationsPanel from "./notifications-panel";

export default function DmList() {
    return (
        <div className='w-full select-none border-b border-border/70 rounded-t-lg p-3 px-4 flex items-center justify-between'>
            <div>Direct Messages</div>
            <div className="absolute top-4 right-4 flex ">
                <NotificationsPanel />
            </div>
        </div>
    )
}