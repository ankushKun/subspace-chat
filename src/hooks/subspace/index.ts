import { Subspace } from "@/lib/subspace"
import { create } from "zustand"

interface SubspaceState {
    subspace: Subspace
}

const useSubspace_ = create<SubspaceState>()((set, get) => ({
    subspace: new Subspace()
}))

// function that just returns the subspace
const useSubspace = () => {
    return useSubspace_(state => state.subspace)
}

export default useSubspace

export { useMessages } from "./messages"
export { useServer } from "./server"
export { useProfile } from "./profiles"
export { useNotifications } from "./notifications"