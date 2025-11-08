const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main(){
  await prisma.user.create({
    data: {
      firebaseId: 'seed-fb-1',
      email: 'owner@example.com',
      name: 'Owner One',
      role: 'OWNER'
    }
  })
  await prisma.user.create({
    data: {
      firebaseId: 'seed-fb-2',
      email: 'tenant@example.com',
      name: 'Tenant One',
      role: 'TENANT'
    }
  })
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
