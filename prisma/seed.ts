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

  // ==========================================
  // CATEGORIES
  // ==========================================

  // 1. School Uniforms
  const schoolCategory = await prisma.category.upsert({
    where: { slug: 'school-uniforms' },
    update: {
      imageUrl: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791190396/emmanuel-ikwuegbu-m4h6qtdogMk-unsplash.jpg',
    },
    create: {
      name: 'School Uniforms',
      slug: 'school-uniforms',
      description: 'Primary and secondary school uniforms, shirts, pants, and student Lacoste polo t-shirts.',
      imageUrl: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791190396/emmanuel-ikwuegbu-m4h6qtdogMk-unsplash.jpg',
    },
  });

  // 2. Men's Fashion
  const fashionCategory = await prisma.category.upsert({
    where: { slug: 'mens-fashion' },
    update: {
      imageUrl: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791035646/patrick-amofah-m04lnaPvrrA-unsplash.jpg',
    },
    create: {
      name: "Men's Fashion",
      slug: 'mens-fashion',
      description: 'Formal and casual clothing including tailored shirts, t-shirts, pants, vests, and jackets.',
      imageUrl: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791035646/patrick-amofah-m04lnaPvrrA-unsplash.jpg',
    },
  });

  // 3. Engineering & Workwear
  const engineeringCategory = await prisma.category.upsert({
    where: { slug: 'engineering-workwear' },
    update: {
      imageUrl: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033025/work_wear_pants_and_shirts.jpg',
    },
    create: {
      name: 'Engineering & Workwear',
      slug: 'engineering-workwear',
      description: 'Technician uniforms, industrial overalls, safety vests, work jackets, aprons, and safety pants.',
      imageUrl: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033025/work_wear_pants_and_shirts.jpg',
    },
  });

  // 4. Hospitality & Culinary
  const hospitalityCategory = await prisma.category.upsert({
    where: { slug: 'hospitality-culinary' },
    update: {
      imageUrl: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/cuisine_shirts.jpg',
    },
    create: {
      name: 'Hospitality & Culinary',
      slug: 'hospitality-culinary',
      description: 'Professional chef coats, kitchen uniforms, waiter aprons, and hospitality attire.',
      imageUrl: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/cuisine_shirts.jpg',
    },
  });

  // 5. Caps & Headwear
  const headwearCategory = await prisma.category.upsert({
    where: { slug: 'caps-headwear' },
    update: {
      imageUrl: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/cap.jpg',
    },
    create: {
      name: 'Caps & Headwear',
      slug: 'caps-headwear',
      description: 'Custom embroidered baseball caps, promotional hats, and headwear.',
      imageUrl: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/cap.jpg',
    },
  });

  // ==========================================
  // PRODUCTS
  // ==========================================

  // --- SCHOOL UNIFORMS ---
  await prisma.product.upsert({
    where: { slug: 'student-lacoste-polo-tshirt' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033023/lacoste.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: 'Student Lacoste Polo T-Shirt',
      slug: 'student-lacoste-polo-tshirt',
      description: 'High-quality cotton polo shirt for school students.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033023/lacoste.jpg',
          isPrimary: true,
        },
      },
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
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791034547/josh-kidd-WZeEP7pwsNo-unsplash.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: 'School Pants & Shirts Set',
      slug: 'school-pants-and-shirts-set',
      description: 'Tailored school trousers and matching button-up shirt.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791034547/josh-kidd-WZeEP7pwsNo-unsplash.jpg',
          isPrimary: true,
        },
      },
      price: 25000,
      stockQuantity: 50,
      minimumStockLevel: 5,
      categoryId: schoolCategory.id,
      sizes: ['S', 'M', 'L'],
      colors: ['Navy Blue', 'Khaki', 'White'],
    },
  });

  // --- MEN'S FASHION ---
  await prisma.product.upsert({
    where: { slug: 'worker-jacket' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033024/NA-GARMENTS_JACKET.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: 'Worker Jacket',
      slug: 'worker-jacket',
      description: 'Durable work jacket designed for everyday use and smart casual fashion.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033024/NA-GARMENTS_JACKET.jpg',
          isPrimary: true,
        },
      },
      price: 45000,
      stockQuantity: 20,
      minimumStockLevel: 3,
      categoryId: fashionCategory.id,
      sizes: ['M', 'L', 'XL'],
      colors: ['Black', 'Navy', 'Grey'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'padded-puffer-bodywarmer-vest' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033022/fashion_jacket.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: 'Padded Puffer Bodywarmer Vest',
      slug: 'padded-puffer-bodywarmer-vest',
      description: 'Insulated zip-up padded puffer vest with customizable chest embroidery.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033022/fashion_jacket.jpg',
          isPrimary: true,
        },
      },
      price: 38000,
      stockQuantity: 25,
      minimumStockLevel: 5,
      categoryId: fashionCategory.id,
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Navy Blue', 'Black'],
    },
  });

  // --- ENGINEERING & WORKWEAR ---
  await prisma.product.upsert({
    where: { slug: 'industrial-overall-ibisarubeti' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033024/overall.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: 'Industrial Overall',
      slug: 'industrial-overall-ibisarubeti',
      description: 'Heavy-duty full body workwear overall with reflective safety straps for technicians.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033024/overall.jpg',
          isPrimary: true,
        },
      },
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
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033024/pant_and_shirts_work_wear.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: 'Technician Pants & Apron Set',
      slug: 'technician-pants-and-apron-set',
      description: 'Durable workshop pants paired with a protective work apron.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033024/pant_and_shirts_work_wear.jpg',
          isPrimary: true,
        },
      },
      price: 30000,
      stockQuantity: 30,
      minimumStockLevel: 5,
      categoryId: engineeringCategory.id,
      sizes: ['M', 'L', 'XL'],
      colors: ['Navy Blue', 'Dark Green'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'high-visibility-reflective-safety-vest' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/different_jackets.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: 'High-Visibility Reflective Safety Vest',
      slug: 'high-visibility-reflective-safety-vest',
      description: 'Multi-pocket reflective safety vest for site engineers, construction, and field workers.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/different_jackets.jpg',
          isPrimary: true,
        },
      },
      price: 18000,
      stockQuantity: 60,
      minimumStockLevel: 10,
      categoryId: engineeringCategory.id,
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Neon Green', 'Yellow', 'Orange', 'Navy Blue', 'Black', 'Light Grey'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'multi-pocket-tactical-utility-vest' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033022/jacket_2.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: 'Multi-Pocket Tactical Utility Vest',
      slug: 'multi-pocket-tactical-utility-vest',
      description: 'Durable multi-pocket cargo utility vest with zipper pockets for technicians and field supervisors.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033022/jacket_2.jpg',
          isPrimary: true,
        },
      },
      price: 28000,
      stockQuantity: 35,
      minimumStockLevel: 5,
      categoryId: engineeringCategory.id,
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Khaki', 'Beige', 'Navy Blue'],
    },
  });

  // --- HOSPITALITY & CULINARY ---
  await prisma.product.upsert({
    where: { slug: 'executive-double-breasted-chef-jacket' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/cuisine_shirts.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: 'Executive Double-Breasted Chef Jacket',
      slug: 'executive-double-breasted-chef-jacket',
      description: 'Professional double-breasted white chef coat with contrasting black trim collars and cuffs.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/cuisine_shirts.jpg',
          isPrimary: true,
        },
      },
      price: 32000,
      stockQuantity: 30,
      minimumStockLevel: 5,
      categoryId: hospitalityCategory.id,
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['White/Black Trim'],
    },
  });

  // --- CAPS & HEADWEAR ---
  await prisma.product.upsert({
    where: { slug: 'custom-embroidered-baseball-cap' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/cap.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: 'Custom Embroidered Baseball Cap',
      slug: 'custom-embroidered-baseball-cap',
      description: 'Structured 5-panel baseball cap with custom embroidered organizational or company logo.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/cap.jpg',
          isPrimary: true,
        },
      },
      price: 8000,
      stockQuantity: 150,
      minimumStockLevel: 20,
      categoryId: headwearCategory.id,
      sizes: ['Adjustable One Size'],
      colors: ['Neon Green', 'Navy Blue', 'Black', 'Red'],
    },
  });

  // --- MORE MEN'S FASHION ---
  await prisma.product.upsert({
    where: { slug: 'mens-classic-crewneck-tshirt' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791035646/patrick-amofah-m04lnaPvrrA-unsplash.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: "Men's Classic Cotton T-Shirt",
      slug: 'mens-classic-crewneck-tshirt',
      description: '100% combed cotton heavy-blend crewneck T-shirt for everyday wear or custom embroidery.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791035646/patrick-amofah-m04lnaPvrrA-unsplash.jpg',
          isPrimary: true,
        },
      },
      price: 12000,
      stockQuantity: 80,
      minimumStockLevel: 10,
      categoryId: fashionCategory.id,
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Black', 'White', 'Navy Blue', 'Grey'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'mens-button-down-formal-shirt' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791034804/nimble-made-_PFanxhwe4o-unsplash.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: "Men's Tailored Button-Down Shirt",
      slug: 'mens-button-down-formal-shirt',
      description: 'Crisp, wrinkle-resistant long sleeve shirt for formal wear and office styling.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791034804/nimble-made-_PFanxhwe4o-unsplash.jpg',
          isPrimary: true,
        },
      },
      price: 28000,
      stockQuantity: 45,
      minimumStockLevel: 5,
      categoryId: fashionCategory.id,
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Sky Blue', 'White', 'Charcoal Grey'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'mens-slim-fit-chino-pants' },
    update: {
      images: {
        deleteMany: {},
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033025/work_wear_pants_and_shirts.jpg',
          isPrimary: true,
        },
      },
    },
    create: {
      name: "Men's Tailored Chino Pants",
      slug: 'mens-slim-fit-chino-pants',
      description: 'Stretch cotton tailored chino trousers designed for smart-casual wear and comfort.',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033025/work_wear_pants_and_shirts.jpg',
          isPrimary: true,
        },
      },
      price: 32000,
      stockQuantity: 40,
      minimumStockLevel: 5,
      categoryId: fashionCategory.id,
      sizes: ['30', '32', '34', '36', '38'],
      colors: ['Khaki', 'Navy Blue', 'Black', 'Beige'],
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