import { prisma } from "@/database/prisma";
import { NotFoundError, ValidationError } from "@/common/errors";

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });
  if (!user) throw new NotFoundError("User not found");

  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    name: user.name,
    isPhoneVerified: user.isPhoneVerified,
    roles: user.roles.map((r) => r.role),
    createdAt: user.createdAt,
  };
}

export async function updateUser(userId: string, data: { name?: string; email?: string }) {
  if (data.email) {
    const emailSchemaCheck = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailSchemaCheck.test(data.email)) {
      throw new ValidationError("Enter a valid email address");
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: data.name, email: data.email },
    include: { roles: true },
  });

  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    name: user.name,
    isPhoneVerified: user.isPhoneVerified,
    roles: user.roles.map((r) => r.role),
  };
}
