import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
import { AuthService } from '../src/auth/auth.service';
import { Role } from '@prisma/client';
import { StoryTone } from '../src/templates/enums/story-tone.enum';

describe('Templates (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersService: UsersService;
  let authService: AuthService;

  const uniqueEmail = (prefix: string) =>
    `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;

  const createTherapistWithToken = async () => {
    const user = await usersService.create({
      email: uniqueEmail('therapist'),
      password: 'test123456',
      role: Role.THERAPIST,
    });

    await prisma.therapistProfile.create({
      data: {
        userId: user.id,
      },
    });

    const { access_token } = authService.login(user);
    return { user, accessToken: access_token };
  };

  const registerChild = async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail('child'),
        password: 'test123456',
        role: Role.CHILD,
      })
      .expect(201);

    const body = response.body as { access_token: string };
    return body.access_token;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    usersService = app.get(UsersService);
    authService = app.get(AuthService);
  });

  beforeEach(async () => {
    await prisma.storyTemplate.deleteMany();
    await prisma.therapistProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects template creation for CHILD (403)', async () => {
    const childToken = await registerChild();

    await request(app.getHttpServer())
      .post('/templates')
      .set('Authorization', `Bearer ${childToken}`)
      .send({
        targetBehavior: 'Turn-taking',
        setting: 'Playground',
        characterDetails: 'Two kids sharing a ball',
        emotionalTone: StoryTone.CALM,
        promptSuggestion: 'Keep it short',
      })
      .expect(403);
  });

  it('allows template creation for THERAPIST (201)', async () => {
    const { accessToken } = await createTherapistWithToken();

    const response = await request(app.getHttpServer())
      .post('/templates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        targetBehavior: 'Turn-taking',
        setting: 'Playground',
        characterDetails: 'Two kids sharing a ball',
        emotionalTone: StoryTone.CALM,
        promptSuggestion: 'Keep it short',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('therapistId');
  });

  it("rejects edits to another therapist's template (403)", async () => {
    const therapistA = await createTherapistWithToken();
    const therapistB = await createTherapistWithToken();

    const createResponse = await request(app.getHttpServer())
      .post('/templates')
      .set('Authorization', `Bearer ${therapistA.accessToken}`)
      .send({
        targetBehavior: 'Sharing',
        setting: 'Classroom',
        characterDetails: 'Two students sharing crayons',
        emotionalTone: StoryTone.ENCOURAGING,
        promptSuggestion: 'Short and positive',
      })
      .expect(201);

    const createdBody = createResponse.body as { id: string };
    const templateId = createdBody.id;

    await request(app.getHttpServer())
      .patch(`/templates/${templateId}`)
      .set('Authorization', `Bearer ${therapistB.accessToken}`)
      .send({
        targetBehavior: 'Updated',
      })
      .expect(403);
  });
});
