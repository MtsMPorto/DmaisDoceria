import { prisma } from "../../config/prisma.js";
import type { CreateTestimonialInput, UpdateTestimonialInput } from "./testimonials.schema.js";

const adminSelect = {
  id: true,
  name: true,
  city: true,
  stars: true,
  text: true,
  avatar: true,
  published: true,
  sortOrder: true,
} as const;

const order = [{ sortOrder: "asc" }, { id: "asc" }] as const;

export function listPublished() {
  return prisma.testimonial.findMany({
    where: { published: true },
    orderBy: [...order],
    select: { id: true, name: true, city: true, stars: true, text: true, avatar: true },
  });
}

export function listAll() {
  return prisma.testimonial.findMany({ orderBy: [...order], select: adminSelect });
}

export function create(input: CreateTestimonialInput) {
  return prisma.testimonial.create({ data: input, select: adminSelect });
}

export async function exists(id: number): Promise<boolean> {
  return (await prisma.testimonial.count({ where: { id } })) > 0;
}

export function update(id: number, input: UpdateTestimonialInput) {
  return prisma.testimonial.update({ where: { id }, data: input, select: adminSelect });
}
