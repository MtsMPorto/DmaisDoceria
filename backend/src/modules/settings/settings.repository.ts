import { prisma } from "../../config/prisma.js";

export function findByKeys(keys: string[]) {
  return prisma.setting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
}
