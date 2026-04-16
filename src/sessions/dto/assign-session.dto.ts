import { Field, InputType } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class AssignSessionDto {
  @Field()
  @IsString()
  @MinLength(1)
  childProfileId: string;

  @Field()
  @IsString()
  @MinLength(1)
  templateId: string;
}
