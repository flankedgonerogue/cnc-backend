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
      firstName: 'System',
      lastName: 'Admin',
      displayName: 'System Admin',
      timezone: 'America/New_York',
      locale: 'en-US',
      emailVerified: true,
    },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      firstName: 'System',
      lastName: 'Admin',
      displayName: 'System Admin',
      timezone: 'America/New_York',
      locale: 'en-US',
      emailVerified: true,
    },
  });

  const guardianUser = await prisma.user.upsert({
    where: { email: 'guardian@example.com' },
    update: {
      passwordHash,
      role: Role.GUARDIAN,
      firstName: 'Maria',
      lastName: 'Lopez',
      displayName: 'Maria L.',
      timezone: 'America/Chicago',
      locale: 'en-US',
      emailVerified: true,
    },
    create: {
      email: 'guardian@example.com',
      passwordHash,
      role: Role.GUARDIAN,
      firstName: 'Maria',
      lastName: 'Lopez',
      displayName: 'Maria L.',
      timezone: 'America/Chicago',
      locale: 'en-US',
      emailVerified: true,
    },
  });

  const therapistUser = await prisma.user.upsert({
    where: { email: 'therapist@example.com' },
    update: {
      passwordHash,
      role: Role.THERAPIST,
      firstName: 'Sarah',
      lastName: 'Chen',
      displayName: 'Dr. Sarah Chen',
      timezone: 'America/New_York',
      locale: 'en-US',
      emailVerified: true,
    },
    create: {
      email: 'therapist@example.com',
      passwordHash,
      role: Role.THERAPIST,
      firstName: 'Sarah',
      lastName: 'Chen',
      displayName: 'Dr. Sarah Chen',
      timezone: 'America/New_York',
      locale: 'en-US',
      emailVerified: true,
    },
  });

  const childUser = await prisma.user.upsert({
    where: { email: 'child@example.com' },
    update: {
      passwordHash,
      role: Role.CHILD,
      firstName: 'Alex',
      lastName: 'Nguyen',
      displayName: 'Alex',
      timezone: 'America/Chicago',
      locale: 'en-US',
      emailVerified: true,
    },
    create: {
      email: 'child@example.com',
      passwordHash,
      role: Role.CHILD,
      firstName: 'Alex',
      lastName: 'Nguyen',
      displayName: 'Alex',
      timezone: 'America/Chicago',
      locale: 'en-US',
      emailVerified: true,
    },
  });

  const therapistProfile = await prisma.therapistProfile.upsert({
    where: { userId: therapistUser.id },
    update: {
      specialization: 'Pediatric play therapy, social skills groups',
      licenseNumber: process.env.SEED_THERAPIST_LICENSE ?? 'LPC-DEMO-10042',
      bio:
        'Licensed therapist focusing on school-age children. Uses narrative and play-based approaches to build emotional regulation and peer skills.',
      clinicName: 'Chronicles & Conversations Demo Clinic',
      interventionThreshold: 0.75,
    },
    create: {
      userId: therapistUser.id,
      specialization: 'Pediatric play therapy, social skills groups',
      licenseNumber: process.env.SEED_THERAPIST_LICENSE ?? 'LPC-DEMO-10042',
      bio:
        'Licensed therapist focusing on school-age children. Uses narrative and play-based approaches to build emotional regulation and peer skills.',
      clinicName: 'Chronicles & Conversations Demo Clinic',
      interventionThreshold: 0.75,
    },
  });

  const behavioralGoalsSeed = {
    primary: 'Practice turn-taking and asking before using shared materials',
    secondary: 'Label feelings when frustrated (e.g. "I feel mad")',
    reviewNotes: 'Seed data for local development and integration tests',
    targetReviewDate: '2026-08-01',
  };

  const guardianProfile = await prisma.guardianProfile.upsert({
    where: { userId: guardianUser.id },
    update: {
      relationship: 'Mother',
      phoneNumber: '+1-555-0100',
      emergencyContactInfo:
        'Secondary: Jordan Lopez +1-555-0101. Pediatrician: Dr. Patel (555-0199).',
      notificationPreferences: {
        emailSessionSummary: true,
        smsReminders: false,
        weeklyDigest: true,
      },
    },
    create: {
      userId: guardianUser.id,
      relationship: 'Mother',
      phoneNumber: '+1-555-0100',
      emergencyContactInfo:
        'Secondary: Jordan Lopez +1-555-0101. Pediatrician: Dr. Patel (555-0199).',
      notificationPreferences: {
        emailSessionSummary: true,
        smsReminders: false,
        weeklyDigest: true,
      },
    },
  });

  // ~8 years old at seed time (adjust DOB yearly if tests depend on exact age)
  const childDob = new Date('2017-05-12T00:00:00.000Z');

  const childProfile = await prisma.childProfile.upsert({
    where: { userId: childUser.id },
    update: {
      therapistId: therapistProfile.id,
      guardianId: guardianProfile.id,
      dateOfBirth: childDob,
      interests: ['dinosaurs', 'drawing', 'soccer', 'Minecraft'],
      triggers: ['unexpected loud sounds', 'losing a competitive game', 'schedule changes'],
      behavioralGoals: behavioralGoalsSeed,
      gamificationData: {
        starsCollected: 12,
        lastBadge: 'Brave Choice',
        streakDays: 3,
      },
      progressStats: {
        sessionsCompletedYtd: 0,
        notes: 'Reset in dev; populated after story sessions',
      },
    },
    create: {
      userId: childUser.id,
      therapistId: therapistProfile.id,
      guardianId: guardianProfile.id,
      dateOfBirth: childDob,
      interests: ['dinosaurs', 'drawing', 'soccer', 'Minecraft'],
      triggers: ['unexpected loud sounds', 'losing a competitive game', 'schedule changes'],
      behavioralGoals: behavioralGoalsSeed,
      gamificationData: {
        starsCollected: 12,
        lastBadge: 'Brave Choice',
        streakDays: 3,
      },
      progressStats: {
        sessionsCompletedYtd: 0,
        notes: 'Reset in dev; populated after story sessions',
      },
    },
  });

  const templates = [
    {
      targetBehavior: 'Turn-taking',
      setting: 'Neighborhood playground on a sunny afternoon',
      mainCharacter: 'A friendly green dinosaur named Dino',
      emotionalTone: 'PLAYFUL',
      promptSuggestion:
        'Keep choices concrete: offer the toy, ask for a turn, or seek an adult’s help—no shame, short sentences.',
      visualStyle:
        'disney-pixar aesthetic, soft daylight, bright playground equipment',
    },
    {
      targetBehavior: 'Calm-down / breathing',
      setting: 'A quiet corner at home with posters and cushions',
      mainCharacter: 'A young astronaut figure the child likes',
      emotionalTone: 'CALM',
      promptSuggestion:
        'Emphasize body-based regulation: count breaths, stretch, name one calm thought.',
      visualStyle:
        'warm illustrated children’s book style, cozy indoor lighting',
    },
  ];

  const seededTemplates: { id: string; targetBehavior: string }[] = [];
  for (const t of templates) {
    const existing = await prisma.storyTemplate.findFirst({
      where: {
        therapistId: therapistProfile.id,
        targetBehavior: t.targetBehavior,
        deletedAt: null,
      },
    });
    const row = existing
      ? await prisma.storyTemplate.update({
          where: { id: existing.id },
          data: {
            setting: t.setting,
            mainCharacter: t.mainCharacter,
            emotionalTone: t.emotionalTone,
            promptSuggestion: t.promptSuggestion,
            visualStyle: t.visualStyle,
          },
        })
      : await prisma.storyTemplate.create({
          data: {
            therapistId: therapistProfile.id,
            ...t,
          },
        });
    seededTemplates.push({ id: row.id, targetBehavior: row.targetBehavior });
  }

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
  console.log(`- ${adminEmail} (Admin)`);
  console.log('- therapist@example.com (Sarah Chen)');
  console.log('- guardian@example.com (Maria Lopez)');
  console.log('- child@example.com (Alex Nguyen)');
  console.log('Default password for non-admin users:', password);
  console.log('Admin credentials:');
  console.log(`- email: ${adminEmail}`);
  console.log(`- password: ${adminPassword}`);
  console.log('Profiles:');
  console.log('- TherapistProfile ID:', therapistProfile.id);
  console.log('  Clinic:', 'Chronicles & Conversations Demo Clinic');
  console.log('- GuardianProfile ID:', guardianProfile.id);
  console.log('- ChildProfile ID:', childProfile.id);
  console.log('  DOB (UTC):', childDob.toISOString().slice(0, 10));
  console.log('Story templates (therapist-owned):');
  for (const st of seededTemplates) {
    console.log(`  - ${st.targetBehavior} (${st.id})`);
  }
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
