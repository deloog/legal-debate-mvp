import prisma from "../src/lib/db/prisma.js";

async function testConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Database connection: true");

    // Test basic queries
    const userCount = await prisma.user.count();
    console.log(`Users in database: ${userCount}`);

    const caseCount = await prisma.case.count();
    console.log(`Cases in database: ${caseCount}`);

    const debateCount = await prisma.debate.count();
    console.log(`Debates in database: ${debateCount}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error("Connection error:", error);
    process.exit(1);
  }
}

testConnection();
