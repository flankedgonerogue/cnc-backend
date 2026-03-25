import { Resolver, Query, Mutation, Args, Context, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { Template } from './template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import { TemplateOwnershipGuard } from './guards/template-ownership.guard';

@Resolver(() => Template)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.THERAPIST)
export class TemplatesResolver {
  constructor(private readonly templatesService: TemplatesService) {}

  @Mutation(() => Template)
  async createTemplate(
    @Args('createTemplateInput') createTemplateDto: CreateTemplateDto,
    @Context() context: any,
  ): Promise<Template> {
    const userId = context.req.user.id;
    return this.templatesService.create(userId, createTemplateDto);
  }

  @Query(() => [Template], { name: 'templates' })
  async findAll(
    @Context() context: any,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
  ): Promise<Template[]> {
    const userId = context.req.user.id;

    const safeTake =
      take !== undefined && Number.isFinite(take)
        ? Math.min(Math.max(take, 1), 100)
        : undefined;
    const safeSkip =
      skip !== undefined && Number.isFinite(skip)
        ? Math.max(skip, 0)
        : undefined;

    return this.templatesService.findAll(userId, {
      take: safeTake,
      skip: safeSkip,
    });
  }

  @Query(() => Template, { name: 'template' })
  @UseGuards(TemplateOwnershipGuard)
  async findOne(
    @Args('id') id: string,
    @Context() context: any,
  ): Promise<Template> {
    const userId = context.req.user.id;
    return this.templatesService.findOne(userId, id);
  }

  @Mutation(() => Template)
  @UseGuards(TemplateOwnershipGuard)
  async updateTemplate(
    @Args('id') id: string,
    @Args('updateTemplateInput') updateTemplateDto: UpdateTemplateDto,
    @Context() context: any,
  ): Promise<Template> {
    const userId = context.req.user.id;
    return this.templatesService.update(userId, id, updateTemplateDto);
  }

  @Mutation(() => Boolean)
  @UseGuards(TemplateOwnershipGuard)
  async removeTemplate(
    @Args('id') id: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.id;
    await this.templatesService.remove(userId, id);
    return true; // Return true to indicate successful deletion
  }
}
