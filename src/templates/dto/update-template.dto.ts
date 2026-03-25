import { InputType, PartialType } from '@nestjs/graphql';
import { CreateTemplateDto } from './create-template.dto';

@InputType()
export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
