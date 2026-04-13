import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty } from 'class-validator';

@InputType()
export class RequestPasswordResetDto {
  @Field()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
