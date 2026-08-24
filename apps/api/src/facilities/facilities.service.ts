import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Facility } from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFacilityDto, UpdateFacilityDto } from './dto/facility.dto';

@Injectable()
export class FacilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(): Promise<Facility[]> {
    return this.prisma.facility.findMany({ orderBy: { code: 'asc' } });
  }

  async create(dto: CreateFacilityDto, userId: string): Promise<Facility> {
    try {
      const facility = await this.prisma.facility.create({
        data: { code: dto.code, name: dto.name, address: dto.address },
      });
      await this.audit.log({
        userId,
        action: 'CREATE_FACILITY',
        entityType: 'FACILITY',
        entityId: facility.id,
        detail: `Tạo cơ sở ${facility.code} — ${facility.name}`,
      });
      return facility;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Mã cơ sở "${dto.code}" đã tồn tại`);
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateFacilityDto, userId: string): Promise<Facility> {
    const existing = await this.prisma.facility.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy cơ sở');

    const facility = await this.prisma.facility.update({ where: { id }, data: dto });
    await this.audit.log({
      userId,
      action: 'UPDATE_FACILITY',
      entityType: 'FACILITY',
      entityId: id,
      detail: `Cập nhật cơ sở ${facility.code}`,
    });
    return facility;
  }
}
