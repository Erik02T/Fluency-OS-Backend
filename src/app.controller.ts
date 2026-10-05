import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/live')
  getLive() {
    return this.appService.getLiveness();
  }

  @Get('health')
  async getHealth() {
    return this.appService.getReadiness();
  }

  @Get('health/ready')
  async getReady() {
    return this.appService.getReadiness();
  }
}
