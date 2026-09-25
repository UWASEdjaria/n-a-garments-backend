import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@natailors.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SecureAdminPassword123!';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: adminEmail,
        passwordHash: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log(`✅ Admin user created: ${adminEmail}`);
  } else {
    console.log('⚠️ Admin user already exists.');
  }

  console.log('Seeding categories and products...');

  // 1. School Uniforms Category
  const schoolCategory = await prisma.category.upsert({
    where: { slug: 'school-uniforms' },
    update: {},
    create: {
      name: 'School Uniforms',
      slug: 'school-uniforms',
      description: 'Primary and secondary school uniforms, shirts, pants, and student Lacoste polo t-shirts.',
    },
  });

  // 2. Men's Fashion Category
  const fashionCategory = await prisma.category.upsert({
    where: { slug: 'mens-fashion' },
    update: {},
    create: {
      name: "Men's Fashion",
      slug: 'mens-fashion',
      description: 'Formal and casual clothing including tailored shirts, t-shirts, pants, and jackets.',
    },
  });

  // 3. Engineering & Workwear Category
  const engineeringCategory = await prisma.category.upsert({
    where: { slug: 'engineering-workwear' },
    update: {},
    create: {
      name: 'Engineering & Workwear',
      slug: 'engineering-workwear',
      description: 'Technician uniforms, industrial overalls, work jackets, aprons, and safety pants.',
    },
  });

  // Sample Products for School Uniforms
  await prisma.product.upsert({
    where: { slug: 'student-lacoste-polo-tshirt' },
    update: {},
    create: {
      name: 'Student Lacoste Polo T-Shirt',
      slug: 'student-lacoste-polo-tshirt',
      description: 'High-quality cotton polo shirt for school students.',
      price: 10000,
      stockQuantity: 100,
      minimumStockLevel: 10,
      categoryId: schoolCategory.id,
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['White', 'Navy Blue', 'Sky Blue'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'school-pants-and-shirts-set' },
    update: {},
    create: {
      name: 'School Pants & Shirts Set',
      slug: 'school-pants-and-shirts-set',
      description: 'Tailored school trousers and matching button-up shirt.',
      price: 25000,
      stockQuantity: 50,
      minimumStockLevel: 5,
      categoryId: schoolCategory.id,
      sizes: ['S', 'M', 'L'],
      colors: ['Navy Blue', 'Khaki', 'White'],
    },
  });

  // Sample Products for Men's Fashion
  await prisma.product.upsert({
    where: { slug: 'tailored-mens-fashion-jacket' },
    update: {},
    create: {
      name: 'Tailored Fashion Jacket',
      slug: 'tailored-mens-fashion-jacket',
      description: 'Custom-fit blazer jacket for casual and formal wear.',
      price: 45000,
      stockQuantity: 20,
      minimumStockLevel: 3,
      categoryId: fashionCategory.id,
      sizes: ['M', 'L', 'XL'],
      colors: ['Black', 'Navy', 'Grey'],
    },
  });

  // Sample Products for Engineering Workwear
  await prisma.product.upsert({
    where: { slug: 'industrial-overall-ibisarubeti' },
    update: {},
    create: {
      name: 'Industrial Overall',
      slug: 'industrial-overall-ibisarubeti',
      description: 'Heavy-duty full body workwear overall with reflective safety straps for technicians.',
      price: 35000,
      stockQuantity: 40,
      minimumStockLevel: 5,
      categoryId: engineeringCategory.id,
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Blue', 'Orange', 'Grey'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'technician-pants-and-apron-set' },
    update: {},
    create: {
      name: 'Technician Pants & Apron Set',
      slug: 'technician-pants-and-apron-set',
      description: 'Durable workshop pants paired with a protective work apron.',
      price: 30000,
      stockQuantity: 30,
      minimumStockLevel: 5,
      categoryId: engineeringCategory.id,
      sizes: ['M', 'L', 'XL'],
      colors: ['Navy Blue', 'Dark Green'],
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });