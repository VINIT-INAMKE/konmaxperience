import { Controller } from '@nestjs/common';
import { GuidesService } from './guides.service';

@Controller('guide')
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}
}
