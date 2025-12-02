const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Counting records... ===\n');
  
  const firstNameCount = await prisma.firstName.count();
  const lastNameCount = await prisma.lastName.count();
  
  console.log('Total First Names:', firstNameCount.toLocaleString());
  console.log('Total Last Names:', lastNameCount.toLocaleString());
  
  console.log('\n=== Checking countries with data ===\n');
  
  const countryStats = await prisma.country.findMany({
    include: {
      _count: {
        select: { firstNames: true, lastNames: true }
      }
    },
    orderBy: { name: 'asc' }
  });
  
  const countriesWithData = countryStats
    .filter(c => c._count.firstNames > 0 || c._count.lastNames > 0)
    .sort((a, b) => (b._count.firstNames + b._count.lastNames) - (a._count.firstNames + a._count.lastNames));
  
  console.log(`Countries with data: ${countriesWithData.length}\n`);
  
  console.log('=== TOP 20 COUNTRIES BY NAME COUNT ===\n');
  countriesWithData.slice(0, 20).forEach(c => {
    const total = c._count.firstNames + c._count.lastNames;
    console.log(`${c.code.padEnd(4)} ${c.name.padEnd(30)} | First: ${String(c._count.firstNames).padStart(10)} | Last: ${String(c._count.lastNames).padStart(10)} | Total: ${String(total).padStart(10)}`);
  });
  
  // Check specific countries
  console.log('\n=== CHECKING YOUR CSV COUNTRIES ===\n');
  const targetCountries = ['JO', 'BD', 'RS'];
  for (const code of targetCountries) {
    const country = countryStats.find(c => c.code === code);
    if (country) {
      console.log(`${code} (${country.name}): ${country._count.firstNames.toLocaleString()} first names, ${country._count.lastNames.toLocaleString()} last names`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
