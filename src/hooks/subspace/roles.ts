import { create } from "zustand";
import { type Role } from "@/types/subspace";

interface RoleState {
    loadingRoles: boolean;
    roles: Record<string, Role[]>; // ServerId -> Role[]

    actions: RoleActions;
}

interface RoleActions {
    setLoadingRoles: (loading: boolean) => void;
    setRoles: (serverId: string, roles: Role[]) => void;
    addRole: (serverId: string, role: Role) => void;
    updateRole: (serverId: string, roleId: number, updatedRole: Partial<Role>) => void;
    removeRole: (serverId: string, roleId: number) => void;
    clearRoles: (serverId: string) => void;
}

export const useRoles = create<RoleState>()((set, get) => ({
    // state
    loadingRoles: false,
    roles: {},

    // actions
    actions: {
        setLoadingRoles: (loading: boolean) => set({ loadingRoles: loading }),

        setRoles: (serverId: string, roles: Role[]) => set((state) => ({
            roles: {
                ...state.roles,
                [serverId]: roles.sort((a, b) => a.orderId - b.orderId)
            }
        })),

        addRole: (serverId: string, role: Role) => set((state) => {
            const existingRoles = state.roles[serverId] || [];
            return {
                roles: {
                    ...state.roles,
                    [serverId]: [...existingRoles, role].sort((a, b) => a.orderId - b.orderId)
                }
            };
        }),

        updateRole: (serverId: string, roleId: number, updatedRole: Partial<Role>) => set((state) => {
            const existingRoles = state.roles[serverId] || [];
            const updatedRoles = existingRoles.map(role =>
                role.roleId === roleId ? { ...role, ...updatedRole } : role
            );
            return {
                roles: {
                    ...state.roles,
                    [serverId]: updatedRoles.sort((a, b) => a.orderId - b.orderId)
                }
            };
        }),

        removeRole: (serverId: string, roleId: number) => set((state) => {
            const existingRoles = state.roles[serverId] || [];
            return {
                roles: {
                    ...state.roles,
                    [serverId]: existingRoles.filter(role => role.roleId !== roleId)
                }
            };
        }),

        clearRoles: (serverId: string) => set((state) => {
            const { [serverId]: removed, ...remainingRoles } = state.roles;
            return { roles: remainingRoles };
        }),
    }
})); 