import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import Arweave from "arweave";
import type { JWKInterface } from "arweave/web/lib/wallet";
import { Constants } from "./constants";
import type { AoFetchResponse } from "ao-fetch";
import { ArconnectSigner, ArweaveSigner, TurboFactory } from '@ardrive/turbo-sdk/web';
import { Permission, hasPermission, type Server, type ServerMember } from "@/types/subspace"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortenAddress(address: string) {
  return address.slice(0, 5) + "..." + address.slice(-5)
}

export class Logger {
  static info(identifier: string, res: AoFetchResponse) {
    console.info(`[${identifier}]`, JSON.stringify(res.text ?? res.json))
  }

  static error(identifier: string, res: AoFetchResponse) {
    throw new Error(`[${identifier}|${res.status}]\n${JSON.stringify(res.error ?? res.json ?? res.text)}`)
  }
}

export function fileToUint8Array(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export async function uploadFileAR(file: File, jwk?: JWKInterface) {
  const ar = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  const data = await fileToUint8Array(file);
  const tx = await ar.createTransaction({ data }, jwk ?? "use_wallet");

  tx.addTag("Content-Type", file.type);
  tx.addTag("Name", file.name);
  tx.addTag(Constants.TagNames.AppName, Constants.TagValues.AppName);
  tx.addTag(Constants.TagNames.AppVersion, Constants.TagValues.AppVersion);
  tx.addTag(Constants.TagNames.SubspaceFunction, Constants.TagValues.UploadFileAR);

  await ar.transactions.sign(tx, jwk ? jwk : "use_wallet");
  const res = await ar.transactions.post(tx);

  if (res.status == 200) {
    console.log("Uploaded file to AR:", res)
    return tx.id;
  } else {
    Logger.error("uploadFileAR", { json: res });
  }
}

export async function uploadFileTurbo(file: File, jwk?: JWKInterface) {
  const signer = jwk ? new ArweaveSigner(jwk) : new ArconnectSigner(window.arweaveWallet)
  try {
    const turbo = TurboFactory.authenticated({ signer })
    const res = await turbo.uploadFile({
      fileStreamFactory: () => file.stream(),
      fileSizeFactory: () => file.size,
      dataItemOpts: {
        tags: [
          { name: Constants.TagNames.AppName, value: Constants.TagValues.AppName },
          { name: Constants.TagNames.AppVersion, value: Constants.TagValues.AppVersion },
          { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UploadFileTurbo },
          { name: "Content-Type", value: file.type ?? "application/octet-stream" },
          { name: "Name", value: file.name ?? "unknown" },
        ],
      }
    })
    console.log("Uploaded file to Turbo:", res)
    return res.id;
  } catch (error) {
    Logger.error("uploadFileTurbo", { json: error });
    return undefined
  }
}

/**
 * Check if a user has a specific permission on a server through their roles
 * @param server - The server object containing roles and members
 * @param userId - The user ID to check permissions for
 * @param permission - The permission to check
 * @returns boolean indicating if the user has the permission
 */
export function userHasPermission(
  server: Server | null,
  userId: string | undefined,
  permission: Permission
): boolean {
  if (!server || !userId) {
    return false
  }

  // Server owner always has all permissions
  if (server.owner === userId) {
    return true
  }

  // Find the user's member data
  const member = server.members?.find(m => m.userId === userId)
  if (!member || !member.roles) {
    return false
  }

  // Check if any of the user's roles grant the permission
  for (const roleId of member.roles) {
    const role = server.roles?.find(r => r.roleId === roleId)
    if (role) {
      // Administrator permission grants all other permissions
      if (hasPermission(role.permissions, Permission.ADMINISTRATOR)) {
        return true
      }
      // Check for the specific permission
      if (hasPermission(role.permissions, permission)) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if a user has any of the specified permissions on a server
 * @param server - The server object containing roles and members
 * @param userId - The user ID to check permissions for
 * @param permissions - Array of permissions to check (user needs at least one)
 * @returns boolean indicating if the user has any of the permissions
 */
export function userHasAnyPermission(
  server: Server | null,
  userId: string | undefined,
  permissions: Permission[]
): boolean {
  if (!server || !userId || permissions.length === 0) {
    return false
  }

  return permissions.some(permission =>
    userHasPermission(server, userId, permission)
  )
}

/**
 * Get all permissions a user has on a server through their roles
 * @param server - The server object containing roles and members
 * @param userId - The user ID to get permissions for
 * @returns Array of permissions the user has
 */
export function getUserPermissions(
  server: Server | null,
  userId: string | undefined
): Permission[] {
  if (!server || !userId) {
    return []
  }

  // Server owner has all permissions
  if (server.owner === userId) {
    return Object.values(Permission).filter(p => typeof p === 'number') as Permission[]
  }

  // Find the user's member data
  const member = server.members?.find(m => m.userId === userId)
  if (!member || !member.roles) {
    return []
  }

  // Collect all permissions from all roles (using Set to avoid duplicates)
  const permissionsSet = new Set<Permission>()

  for (const roleId of member.roles) {
    const role = server.roles?.find(r => r.roleId === roleId)
    if (role) {
      // If user has administrator permission, they have all permissions
      if (hasPermission(role.permissions, Permission.ADMINISTRATOR)) {
        return Object.values(Permission).filter(p => typeof p === 'number') as Permission[]
      }

      // Otherwise, check each permission bit
      Object.values(Permission).forEach(permission => {
        if (typeof permission === 'number' && hasPermission(role.permissions, permission)) {
          permissionsSet.add(permission)
        }
      })
    }
  }

  return Array.from(permissionsSet)
}

/**
 * Check if a user can manage server settings (has MANAGE_SERVER or ADMINISTRATOR permission)
 * @param server - The server object containing roles and members
 * @param userId - The user ID to check
 * @returns boolean indicating if the user can manage server settings
 */
export function canManageServer(
  server: Server | null,
  userId: string | undefined
): boolean {
  return userHasAnyPermission(server, userId, [
    Permission.MANAGE_SERVER,
    Permission.ADMINISTRATOR
  ])
}

/**
 * Check if a user is the server owner
 * @param server - The server object
 * @param userId - The user ID to check
 * @returns boolean indicating if the user is the server owner
 */
export function isServerOwner(
  server: Server | null,
  userId: string | undefined
): boolean {
  if (!server || !userId) {
    return false
  }
  return server.owner === userId
}

/**
 * Get the highest role order for a user (lower orderId = higher hierarchy)
 * @param server - The server object containing roles and members
 * @param userId - The user ID to check
 * @returns The highest role order (lowest orderId) or null if no roles
 */
export function getUserHighestRoleOrder(
  server: Server | null,
  userId: string | undefined
): number | null {
  if (!server || !userId) {
    return null
  }

  // Server owner has highest possible hierarchy
  if (server.owner === userId) {
    return 0
  }

  // Find the user's member data
  const member = server.members?.find(m => m.userId === userId)
  if (!member || !member.roles || member.roles.length === 0) {
    return null // No roles
  }

  let highestOrder: number | null = null
  for (const roleId of member.roles) {
    const role = server.roles?.find(r => r.roleId === roleId)
    if (role) {
      if (highestOrder === null || role.orderId < highestOrder) {
        highestOrder = role.orderId
      }
    }
  }

  return highestOrder
}

/**
 * Check if user A can manage user B's roles based on hierarchy
 * @param server - The server object containing roles and members
 * @param userA - The user attempting to manage roles
 * @param userB - The target user whose roles are being managed
 * @returns boolean indicating if userA can manage userB's roles
 */
export function canManageUserRoles(
  server: Server | null,
  userA: string | undefined,
  userB: string | undefined
): boolean {
  if (!server || !userA || !userB) {
    return false
  }

  // Server owner can manage anyone
  if (server.owner === userA) {
    return true
  }

  // Users cannot manage their own roles through this system
  if (userA === userB) {
    return false
  }

  const orderA = getUserHighestRoleOrder(server, userA)
  const orderB = getUserHighestRoleOrder(server, userB)

  // If userA has no roles, they can't manage anyone
  if (orderA === null) {
    return false
  }

  // If userB has no roles, userA can manage them (as long as userA has roles)
  if (orderB === null) {
    return true
  }

  // userA can only manage userB if userA has strictly higher hierarchy (lower orderId)
  return orderA < orderB
}

/**
 * Check if user can assign a specific role based on hierarchy
 * @param server - The server object containing roles and members
 * @param userId - The user attempting to assign the role
 * @param roleId - The role being assigned
 * @returns boolean indicating if the user can assign this role
 */
export function canAssignRole(
  server: Server | null,
  userId: string | undefined,
  roleId: number
): boolean {
  if (!server || !userId) {
    return false
  }

  // Server owner can assign any role
  if (server.owner === userId) {
    return true
  }

  const userHighestOrder = getUserHighestRoleOrder(server, userId)
  if (userHighestOrder === null) {
    return false // User has no roles, can't assign anything
  }

  const role = server.roles?.find(r => r.roleId === roleId)
  if (!role) {
    return false // Role doesn't exist
  }

  // User can only assign roles that are lower in hierarchy (higher orderId)
  return userHighestOrder < role.orderId
}

/**
 * Check if user can remove a specific role from themselves
 * @param server - The server object containing roles and members
 * @param userId - The user attempting to remove their own role
 * @param roleId - The role being removed
 * @returns boolean indicating if the user can remove this role from themselves
 */
export function canRemoveOwnRole(
  server: Server | null,
  userId: string | undefined,
  roleId: number
): boolean {
  if (!server || !userId) {
    return false
  }

  // Server owner can do anything
  if (server.owner === userId) {
    return true
  }

  const member = server.members?.find(m => m.userId === userId)
  if (!member || !member.roles) {
    return false
  }

  // Don't allow removing the last/only role
  if (member.roles.length <= 1) {
    return false
  }

  const userHighestOrder = getUserHighestRoleOrder(server, userId)
  const role = server.roles?.find(r => r.roleId === roleId)

  if (!role || userHighestOrder === null) {
    return false
  }

  // User cannot remove their highest role
  return role.orderId > userHighestOrder
}

/**
 * Check if user can remove a specific role from another user based on hierarchy
 * @param server - The server object containing roles and members
 * @param currentUserId - The user attempting to remove the role
 * @param targetUserId - The user whose role is being removed
 * @param roleId - The role being removed
 * @returns boolean indicating if the user can remove this role from the target user
 */
export function canRemoveRoleFromUser(
  server: Server | null,
  currentUserId: string | undefined,
  targetUserId: string | undefined,
  roleId: number
): boolean {
  if (!server || !currentUserId || !targetUserId) {
    return false
  }

  // Server owner can remove any role from anyone
  if (server.owner === currentUserId) {
    return true
  }

  // Must have MANAGE_ROLES permission
  if (!userHasPermission(server, currentUserId, Permission.MANAGE_ROLES)) {
    return false
  }

  // For self-removal, use the specialized function
  if (currentUserId === targetUserId) {
    return canRemoveOwnRole(server, currentUserId, roleId)
  }

  // Check if the requesting user can manage the target user's roles
  if (!canManageUserRoles(server, currentUserId, targetUserId)) {
    return false
  }

  // Check if the specific role being removed is below the requesting user's hierarchy
  const currentUserHighestOrder = getUserHighestRoleOrder(server, currentUserId)
  if (currentUserHighestOrder === null) {
    return false // User has no roles, can't remove anything
  }

  const role = server.roles?.find(r => r.roleId === roleId)
  if (!role) {
    return false // Role doesn't exist
  }

  // User can only remove roles that are strictly lower in hierarchy (higher orderId)
  return role.orderId > currentUserHighestOrder
}

/**
 * Check if user can manage role assignments for a specific target user
 * This includes both managing others' roles and self-role management
 * @param server - The server object containing roles and members
 * @param currentUserId - The user attempting to manage roles
 * @param targetUserId - The user whose roles are being managed
 * @returns boolean indicating if role management is allowed
 */
export function canManageRoleAssignments(
  server: Server | null,
  currentUserId: string | undefined,
  targetUserId: string | undefined
): boolean {
  if (!server || !currentUserId || !targetUserId) {
    return false
  }

  // Must have MANAGE_ROLES permission
  if (!userHasPermission(server, currentUserId, Permission.MANAGE_ROLES)) {
    return false
  }

  // Self-management is allowed if user has MANAGE_ROLES permission
  if (currentUserId === targetUserId) {
    return true
  }

  // Managing others requires hierarchy check
  return canManageUserRoles(server, currentUserId, targetUserId)
}

/**
 * Check if user can edit a specific role based on hierarchy
 * @param server - The server object containing roles and members
 * @param userId - The user attempting to edit the role
 * @param roleId - The role being edited
 * @returns boolean indicating if the user can edit this role
 */
export function canEditRole(
  server: Server | null,
  userId: string | undefined,
  roleId: number
): boolean {
  if (!server || !userId) {
    return false
  }

  // Server owner can edit any role
  if (server.owner === userId) {
    return true
  }

  // Must have MANAGE_ROLES permission
  if (!userHasPermission(server, userId, Permission.MANAGE_ROLES)) {
    return false
  }

  const userHighestOrder = getUserHighestRoleOrder(server, userId)
  if (userHighestOrder === null) {
    return false // User has no roles, can't edit anything
  }

  const role = server.roles?.find(r => r.roleId === roleId)
  if (!role) {
    return false // Role doesn't exist
  }

  // User can only edit roles that are strictly lower in hierarchy (higher orderId)
  return role.orderId > userHighestOrder
}

/**
 * Check if user can delete a specific role based on hierarchy
 * @param server - The server object containing roles and members
 * @param userId - The user attempting to delete the role
 * @param roleId - The role being deleted
 * @returns boolean indicating if the user can delete this role
 */
export function canDeleteRole(
  server: Server | null,
  userId: string | undefined,
  roleId: number
): boolean {
  // Same logic as canEditRole for now
  return canEditRole(server, userId, roleId)
}

/**
 * Check if user can move a role to a specific position based on hierarchy
 * @param server - The server object containing roles and members
 * @param userId - The user attempting to move the role
 * @param roleId - The role being moved
 * @param newOrderId - The new order position
 * @returns boolean indicating if the user can move this role to this position
 */
export function canMoveRole(
  server: Server | null,
  userId: string | undefined,
  roleId: number,
  newOrderId: number
): boolean {
  if (!server || !userId) {
    return false
  }

  // Server owner can move any role anywhere
  if (server.owner === userId) {
    return true
  }

  // Must have MANAGE_ROLES permission
  if (!userHasPermission(server, userId, Permission.MANAGE_ROLES)) {
    return false
  }

  const userHighestOrder = getUserHighestRoleOrder(server, userId)
  if (userHighestOrder === null) {
    return false // User has no roles, can't move anything
  }

  const role = server.roles?.find(r => r.roleId === roleId)
  if (!role) {
    return false // Role doesn't exist
  }

  // User can only move roles that are below their hierarchy
  if (role.orderId <= userHighestOrder) {
    return false
  }

  // User cannot move role to a position above their highest role
  if (newOrderId <= userHighestOrder) {
    return false
  }

  return true
}