const { PrismaClient } = require('@prisma/client');
const { subDays } = require('date-fns');

const prisma = new PrismaClient();

const CATEGORIES = {
  INCOME: [
    { name: "salary", range: [5000, 8000] },
    { name: "freelance", range: [1000, 3000] },
    { name: "investments", range: [500, 2000] },
    { name: "other-income", range: [100, 1000] },
  ],
  EXPENSE: [
    { name: "housing", range: [1000, 2000] },
    { name: "transportation", range: [100, 500] },
    { name: "groceries", range: [200, 600] },
    { name: "utilities", range: [100, 300] },
    { name: "entertainment", range: [50, 200] },
    { name: "food", range: [50, 150] },
    { name: "shopping", range: [100, 500] },
    { name: "healthcare", range: [100, 1000] },
    { name: "education", range: [200, 1000] },
    { name: "travel", range: [500, 2000] },
  ],
};

function getRandomAmount(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function getRandomCategory(type) {
  const categories = CATEGORIES[type];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const amount = getRandomAmount(category.range[0], category.range[1]);
  return { category: category.name, amount };
}

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Create a test user
    const user = await prisma.user.upsert({
      where: { clerkUserId: 'test-user-123' },
      update: {},
      create: {
        clerkUserId: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        imageUrl: 'https://example.com/avatar.jpg',
      },
    });

    console.log('Created user:', user.id);

    // Create a test account
    const account = await prisma.account.upsert({
      where: { id: 'test-account-123' },
      update: {},
      create: {
        id: 'test-account-123',
        name: 'Main Account',
        type: 'CURRENT',
        balance: 0,
        isDefault: true,
        userId: user.id,
      },
    });

    console.log('Created account:', account.id);

    // Generate 90 days of transactions
    const transactions = [];
    let totalBalance = 0;

    for (let i = 90; i >= 0; i--) {
      const date = subDays(new Date(), i);

      // Generate 1-3 transactions per day
      const transactionsPerDay = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < transactionsPerDay; j++) {
        // 40% chance of income, 60% chance of expense
        const type = Math.random() < 0.4 ? "INCOME" : "EXPENSE";
        const { category, amount } = getRandomCategory(type);

        const transaction = {
          type,
          amount,
          description: `${
            type === "INCOME" ? "Received" : "Paid for"
          } ${category}`,
          date,
          category,
          status: "COMPLETED",
          userId: user.id,
          accountId: account.id,
        };

        totalBalance += type === "INCOME" ? amount : -amount;
        transactions.push(transaction);
      }
    }

    // Clear existing transactions for this account
    await prisma.transaction.deleteMany({
      where: { accountId: account.id },
    });

    // Insert new transactions
    await prisma.transaction.createMany({
      data: transactions,
    });

    // Update account balance
    await prisma.account.update({
      where: { id: account.id },
      data: { balance: totalBalance },
    });

    console.log(`Created ${transactions.length} transactions`);
    console.log(`Final account balance: $${totalBalance.toFixed(2)}`);
    console.log('Database seeding completed successfully!');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDatabase(); 