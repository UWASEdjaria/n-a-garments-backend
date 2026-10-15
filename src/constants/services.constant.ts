import { ServiceCategory } from "../interfaces/ServiceCategory.interface.js";

export const TAILORING_SERVICES: ServiceCategory[] = [
  {
    id: 'schools',
    title: 'School Garments & Uniforms',
    items: ['School Pants', 'School Shirts', 'Student T-Shirts (Lacoste / Polo)'],
    description: 'Bulk and custom tailoring for primary and secondary schools.',
  },
  {
    id: 'fashion',
    title: 'Men’s Fashion',
    items: ['Casual & Formal Shirts', 'Fashion T-Shirts', 'Pants', 'Jackets'],
    description: 'Bespoke men’s tailoring for everyday wear and special events.',
  },
  {
    id: 'engineering',
    title: 'Engineering & Industrial Workwear',
    items: ['Technician Shirts & Pants', 'Overalls (Ibisarubeti)', 'Work Jackets', 'Aprons'],
    description: 'Durable, high-grade protective workwear designed for site engineers and technicians.',
  },
];