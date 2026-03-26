import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class UserAuth {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field(() => String, { nullable: true })
  role?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  avatarUrl?: string;
}

@ObjectType()
export class AuthResponse {
  @Field()
  access_token: string;

  @Field(() => UserAuth, { nullable: true })
  user?: UserAuth;
}

@ObjectType()
export class GoogleAuthResponse extends AuthResponse {
  @Field()
  isNew: boolean;

  @Field()
  roleRequired: boolean;

  @Field()
  message: string;
}

@ObjectType()
export class VerifyResponse {
  @Field()
  valid: boolean;

  @Field(() => UserAuth)
  user: UserAuth;
}
