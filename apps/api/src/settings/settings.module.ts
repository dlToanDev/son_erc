import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { BackupService } from '../backup/backup.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, BackupService],
})
export class SettingsModule {}
