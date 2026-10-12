import { prisma } from "../../config/prisma.js";

export function createSession(id: string, adminId: number, expiresAt: Date) {
  return prisma.adminSession.create({ data: { id, adminId, expiresAt } });
}

export function findValidSession(id: string, adminId: number) {
  return prisma.adminSession.findFirst({
    where: { id, adminId, revokedAt: null, expiresAt: { gt: new Date() }, admin: { active: true } },
    select: { id: true },
  });
}

export function revokeSession(id: string, adminId: number) {
  return prisma.adminSession.updateMany({
    where: { id, adminId, revokedAt: null }, data: { revokedAt: new Date() },
  });
}

export function findActiveAdminById(id: number) {
  return prisma.adminUser.findFirst({
    where: { id, active: true },
    select: { id: true, name: true, username: true },
  });
}

export function findAdminByUsername(username: string) {
  return prisma.adminUser.findUnique({
    where: { username },
    select: { id: true, passwordHash: true, active: true, lockedUntil: true },
  });
}

// Incremento atômico: duas tentativas simultâneas não se perdem.
export function registerFailedAttempt(id: number): Promise<{ failedAttempts: number }> {
  return prisma.adminUser.update({
    where: { id },
    data: { failedAttempts: { increment: 1 } },
    select: { failedAttempts: true },
  });
}

export async function lockAdmin(id: number, until: Date): Promise<void> {
  await prisma.adminUser.update({
    where: { id },
    data: { failedAttempts: 0, lockedUntil: until },
  });
}

export async function registerSuccessfulLogin(id: number): Promise<void> {
  await prisma.adminUser.update({
    where: { id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
}
