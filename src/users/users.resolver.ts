import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UpdateUserInput } from './dto/update-user.input';
import { CreateChildInput } from './dto/create-child.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => User, { name: 'me' })
  @UseGuards(JwtAuthGuard)
  async getMe(@Context() context: any): Promise<User> {
    const userId = context.req.user.id;
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  @Query(() => User, { name: 'user', nullable: true })
  @UseGuards(JwtAuthGuard)
  async getUser(@Args('id') id: string): Promise<User | undefined> {
    return this.usersService.findById(id);
  }

  @Query(() => [User], { name: 'users' })
  @UseGuards(JwtAuthGuard)
  async getUsers(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Query(() => [User], { name: 'admins' })
  @UseGuards(JwtAuthGuard)
  async getAdmins(): Promise<User[]> {
    return this.usersService.findAdmins();
  }

  @Query(() => [User], { name: 'therapists' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GUARDIAN)
  async getTherapists(): Promise<User[]> {
    return this.usersService.findTherapists();
  }

  @Query(() => [User], { name: 'myChildren' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.THERAPIST)
  async getMyChildren(@Context() context: any): Promise<User[]> {
    return this.usersService.findChildrenByTherapist(context.req.user.id);
  }

  @Query(() => User, { name: 'myChild', nullable: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GUARDIAN)
  async getMyChild(@Context() context: any): Promise<User | undefined> {
    return this.usersService.findChildByGuardian(context.req.user.id);
  }

  @Mutation(() => User, { name: 'addChild' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GUARDIAN)
  async addChild(
    @Args('createChildInput') createChildInput: CreateChildInput,
    @Context() context: any,
  ): Promise<User> {
    return this.usersService.createChildForGuardian(
      context.req.user.id,
      createChildInput,
    );
  }

  @Mutation(() => User, { name: 'updateUser' })
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Args('id', { nullable: true }) id: string,
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
    @Context() context: any,
  ): Promise<User> {
    // If no ID is provided, update the currently authenticated user
    const targetId = id || context.req.user.id;
    return this.usersService.updateUser(targetId, updateUserInput);
  }
}
