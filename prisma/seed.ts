import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL; 
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured in the backend .env file.');
  }
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
  //
  // All products are seeded as MADE_TO_ORDER.
  //
  // These catalogue entries represent garment designs that nagarments
  // produces after a customer submits a quote request. None of these
  // have been confirmed as finished ready-to-wear stock. An administrator
  // must explicitly change a product to READY_TO_WEAR through the admin
  // dashboard once finished stock has been confirmed and is available for
  // immediate sale.
  //
  // The prices shown are indicative starting prices used for quoting
  // purposes only. The final price is agreed between the customer and
  // nagarments after the quote request is reviewed.
  // ==========================================

  // --- SCHOOL UNIFORMS ---
  await prisma.product.upsert({
    where: { slug: 'student-lacoste-polo-tshirt' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033023/lacoste.jpg',
          isPrimary: true,
        },
      },
      price: 10000,
      stockQuantity: 0,
      minimumStockLevel: 10,
      maximumStockLevel: 200,
      isAvailable: true,
      categoryId: schoolCategory.id,
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['White', 'Navy Blue', 'Sky Blue'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'school-pants-and-shirts-set' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791034547/josh-kidd-WZeEP7pwsNo-unsplash.jpg',
          isPrimary: true,
        },
      },
      price: 25000,
      stockQuantity: 0,
      minimumStockLevel: 5,
      maximumStockLevel: 100,
      isAvailable: true,
      categoryId: schoolCategory.id,
      sizes: ['S', 'M', 'L'],
      colors: ['Navy Blue', 'White'],
    },
  });

  // --- MEN'S FASHION ---
  await prisma.product.upsert({
    where: { slug: 'worker-jacket' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033024/NA-GARMENTS_JACKET.jpg',
          isPrimary: true,
        },
      },
      price: 45000,
      stockQuantity: 0,
      minimumStockLevel: 3,
      maximumStockLevel: 50,
      isAvailable: true,
      categoryId: fashionCategory.id,
      sizes: ['M', 'L', 'XL'],
      colors: ['Black', 'Navy', 'Grey'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'padded-puffer-bodywarmer-vest' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033022/fashion_jacket.jpg',
          isPrimary: true,
        },
      },
      price: 38000,
      stockQuantity: 0,
      minimumStockLevel: 5,
      maximumStockLevel: 100,
      isAvailable: true,
      categoryId: fashionCategory.id,
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Navy', 'Black'],
    },
  });

  // --- ENGINEERING & WORKWEAR ---
  await prisma.product.upsert({
    where: { slug: 'industrial-overall-ibisarubeti' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033024/overall.jpg',
          isPrimary: true,
        },
      },
      price: 35000,
      stockQuantity: 0,
      minimumStockLevel: 5,
      maximumStockLevel: 100,
      isAvailable: true,
      categoryId: engineeringCategory.id,
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Blue', 'Grey'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'technician-pants-and-apron-set' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033024/pant_and_shirts_work_wear.jpg',
          isPrimary: true,
        },
      },
      price: 30000,
      stockQuantity: 0,
      minimumStockLevel: 5,
      maximumStockLevel: 100,
      isAvailable: true,
      categoryId: engineeringCategory.id,
      sizes: ['M', 'L', 'XL'],
      colors: ['Navy', 'Green'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'high-visibility-reflective-safety-vest' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/different_jackets.jpg',
          isPrimary: true,
        },
      },
      price: 18000,
      stockQuantity: 0,
      minimumStockLevel: 10,
      maximumStockLevel: 200,
      isAvailable: true,
      categoryId: engineeringCategory.id,
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Yellow', 'Orange', 'Navy', 'Black'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'multi-pocket-tactical-utility-vest' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033022/jacket_2.jpg',
          isPrimary: true,
        },
      },
      price: 28000,
      stockQuantity: 0,
      minimumStockLevel: 5,
      maximumStockLevel: 100,
      isAvailable: true,
      categoryId: engineeringCategory.id,
      sizes: ['M', 'L', 'XL', 'XXL'],
      colors: ['Beige', 'Navy'],
    },
  });

  // --- HOSPITALITY & CULINARY ---
  await prisma.product.upsert({
    where: { slug: 'executive-double-breasted-chef-jacket' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/cuisine_shirts.jpg',
          isPrimary: true,
        },
      },
      price: 32000,
      stockQuantity: 0,
      minimumStockLevel: 5,
      maximumStockLevel: 100,
      isAvailable: true,
      categoryId: hospitalityCategory.id,
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['White'],
    },
  });

  // --- CAPS & HEADWEAR ---
  await prisma.product.upsert({
    where: { slug: 'custom-embroidered-baseball-cap' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033021/cap.jpg',
          isPrimary: true,
        },
      },
      price: 8000,
      stockQuantity: 0,
      minimumStockLevel: 20,
      maximumStockLevel: 500,
      isAvailable: true,
      categoryId: headwearCategory.id,
      sizes: ['M'],
      colors: ['Navy', 'Black', 'Red'],
    },
  });

  // --- MORE MEN'S FASHION ---
  await prisma.product.upsert({
    where: { slug: 'mens-classic-crewneck-tshirt' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791035646/patrick-amofah-m04lnaPvrrA-unsplash.jpg',
          isPrimary: true,
        },
      },
      price: 12000,
      stockQuantity: 0,
      minimumStockLevel: 10,
      maximumStockLevel: 200,
      isAvailable: true,
      categoryId: fashionCategory.id,
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Black', 'White', 'Navy', 'Grey'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'mens-button-down-formal-shirt' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791034804/nimble-made-_PFanxhwe4o-unsplash.jpg',
          isPrimary: true,
        },
      },
      price: 28000,
      stockQuantity: 0,
      minimumStockLevel: 5,
      maximumStockLevel: 100,
      isAvailable: true,
      categoryId: fashionCategory.id,
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['White', 'Grey'],
    },
  });

  await prisma.product.upsert({
    where: { slug: 'mens-slim-fit-chino-pants' },
    update: {
      productType: 'MADE_TO_ORDER',
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
      productType: 'MADE_TO_ORDER',
      images: {
        create: {
          url: 'https://res.cloudinary.com/ziwgo9pj/image/upload/v1791033025/work_wear_pants_and_shirts.jpg',
          isPrimary: true,
        },
      },
      price: 32000,
      stockQuantity: 0,
      minimumStockLevel: 5,
      maximumStockLevel: 100,
      isAvailable: true,
      categoryId: fashionCategory.id,
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Black', 'Navy', 'Beige'],
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
