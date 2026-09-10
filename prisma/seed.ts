import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

export async function main() {
  const password = await bcrypt.hash("Admin@12345", 12);

  const userData: Prisma.UserCreateInput[] = [
    {
      email: "admin@saloonneo.com",
      password,
      firstName: "System",
      lastName: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true,
    },
  ];

  for (const u of userData) {
    await prisma.user.upsert({
      where: {
        email: u.email,
      },
      update: {
        password: u.password,
        firstName: u.firstName,
        lastName: u.lastName,
        role: "ADMIN",
        status: "ACTIVE",
        emailVerified: true,
      },
      create: u,
    });
  }

  console.log("✅ Admin user created successfully");
  console.log("📧 Email: admin@saloonneo.com");
  console.log("🔑 Password: Admin@12345");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });