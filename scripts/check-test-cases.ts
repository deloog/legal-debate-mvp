import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

async function main() {
  const cases = await prisma.case.findMany({
    where: {
      OR: [
        { userId: { startsWith: "test-" } },
        { userId: { startsWith: "test-e2e" } },
      ],
    },
    select: {
      id: true,
      userId: true,
      title: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log("测试案件数据:");
  console.log(JSON.stringify(cases, null, 2));

  // 检查ID格式
  console.log("\nID格式分析:");
  cases.forEach((c) => {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        c.id,
      );
    console.log(
      `- ${c.id.substring(0, 20)}... : ${isUUID ? "UUID格式" : "非UUID格式"} (userId: ${c.userId})`,
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
