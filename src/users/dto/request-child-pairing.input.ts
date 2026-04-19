import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty } from 'class-validator';

@InputType()
export class RequestChildPairingInput {
  @Field()
  @IsEmail()
  @IsNotEmpty()
  childEmail: string;
}
