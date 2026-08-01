import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@ajira.local" },
    update: {},
    create: {
      email: "admin@ajira.local",
      name: "Ajira Admin",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: "buyer@ajira.local" },
    update: {},
    create: {
      email: "buyer@ajira.local",
      name: "Amina Buyer",
      passwordHash,
      role: Role.BUYER,
      phone: "0777000001",
    },
  });

  const seller = await prisma.user.upsert({
    where: { email: "seller@ajira.local" },
    update: {},
    create: {
      email: "seller@ajira.local",
      name: "Tariro Seller",
      passwordHash,
      role: Role.SELLER,
      phone: "0777000002",
      wallet: { create: {} },
    },
  });

  console.log("Seeded users:", {
    admin: admin.email,
    buyer: buyer.email,
    seller: seller.email,
    password: "password123",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
