import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const password = 'test123456';
  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? password;
  const passwordHash = await bcrypt.hash(password, 10);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required to generate access tokens.');
  }
  const jwtExpiresIn = '1m';
  const jwtService = new JwtService({
    secret: jwtSecret,
    signOptions: { expiresIn: jwtExpiresIn },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const guardianUser = await prisma.user.upsert({
    where: { email: 'guardian@example.com' },
    update: {
      passwordHash,
      role: Role.GUARDIAN,
    },
    create: {
      email: 'guardian@example.com',
      passwordHash,
      role: Role.GUARDIAN,
    },
  });

  const therapistUser = await prisma.user.upsert({
    where: { email: 'therapist@example.com' },
    update: {
      passwordHash,
      role: Role.THERAPIST,
    },
    create: {
      email: 'therapist@example.com',
      passwordHash,
      role: Role.THERAPIST,
    },
  });

  const childUser = await prisma.user.upsert({
    where: { email: 'child@example.com' },
    update: {
      passwordHash,
      role: Role.CHILD,
    },
    create: {
      email: 'child@example.com',
      passwordHash,
      role: Role.CHILD,
    },
  });

  const therapistProfile = await prisma.therapistProfile.upsert({
    where: { userId: therapistUser.id },
    update: {
      specialization: 'General',
    },
    create: {
      userId: therapistUser.id,
      specialization: 'General',
    },
  });

  const guardianProfile = await prisma.guardianProfile.upsert({
    where: { userId: guardianUser.id },
    update: {},
    create: {
      userId: guardianUser.id,
    },
  });

  const childProfile = await prisma.childProfile.upsert({
    where: { userId: childUser.id },
    update: {
      therapistId: therapistProfile.id,
      guardianId: guardianProfile.id,
      behavioralGoals: {},
    },
    create: {
      userId: childUser.id,
      therapistId: therapistProfile.id,
      guardianId: guardianProfile.id,
      behavioralGoals: {},
    },
  });

  const adminAccessToken = jwtService.sign({
    sub: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
  });

  const therapistAccessToken = jwtService.sign({
    sub: therapistUser.id,
    email: therapistUser.email,
    role: therapistUser.role,
  });

  const guardianAccessToken = jwtService.sign({
    sub: guardianUser.id,
    email: guardianUser.email,
    role: guardianUser.role,
  });

  const childAccessToken = jwtService.sign({
    sub: childUser.id,
    email: childUser.email,
    role: childUser.role,
  });

  console.log('Seeded users and profiles:');
  console.log(`- ${adminEmail}`);
  console.log('- therapist@example.com');
  console.log('- guardian@example.com');
  console.log('- child@example.com');
  console.log('Default password for non-admin users:', password);
  console.log('Admin credentials:');
  console.log(`- email: ${adminEmail}`);
  console.log(`- password: ${adminPassword}`);
  console.log('Profiles:');
  console.log('- TherapistProfile ID:', therapistProfile.id);
  console.log('- GuardianProfile ID:', guardianProfile.id);
  console.log('- ChildProfile ID:', childProfile.id);
  console.log('Access tokens:');
  console.log('- Admin:', adminAccessToken);
  console.log('- Therapist:', therapistAccessToken);
  console.log('- Guardian:', guardianAccessToken);
  console.log('- Child:', childAccessToken);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
