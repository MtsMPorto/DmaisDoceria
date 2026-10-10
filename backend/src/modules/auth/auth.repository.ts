import { prisma } from "../../config/prisma.js";

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
