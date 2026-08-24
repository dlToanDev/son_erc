import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

const execAsync = promisify(exec);

/** Thông tin 1 bản backup để FE hiển thị. */
export interface BackupInfo {
  fileName: string;
  createdAt: string; // ISO
}

const FILE_RE = /^debtflow-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.sql\.gz$/;
const CONFIRM_PHRASE = 'KHOI PHUC';

@Injectable()
export class BackupService {
  private readonly dir = process.env.BACKUP_DIR ?? '/backups';

  constructor(private readonly audit: AuditService) {}

  /** Suy thời điểm tạo từ tên file debtflow-YYYYMMDD-HHMMSS.sql.gz. */
  private parseCreatedAt(fileName: string): string | null {
    const m = FILE_RE.exec(fileName);
    if (!m) return null;
    const [, y, mo, d, h, mi, s] = m;
    // Tên file dùng giờ địa phương của service backup (TZ=Asia/Ho_Chi_Minh, +07:00).
    return `${y}-${mo}-${d}T${h}:${mi}:${s}+07:00`;
  }

  /** Danh sách backup, mới nhất trước. */
  async list(): Promise<BackupInfo[]> {
    let files: string[];
    try {
      files = await fs.readdir(this.dir);
    } catch {
      return []; // thư mục chưa tồn tại (vd môi trường chưa cấu hình backup)
    }
    return files
      .filter((f) => FILE_RE.test(f))
      .map((f) => ({ fileName: f, createdAt: this.parseCreatedAt(f)! }))
      .sort((a, b) => b.fileName.localeCompare(a.fileName));
  }

  /** Bản backup gần nhất, hoặc null nếu chưa có. */
  async getLatest(): Promise<BackupInfo | null> {
    const all = await this.list();
    return all[0] ?? null;
  }

  /**
   * Khôi phục DB từ bản backup gần nhất (GHI ĐÈ toàn bộ).
   * `gunzip -c <file> | psql "$DATABASE_URL"` — bản dump `--clean --if-exists` tự DROP trước.
   */
  async restoreLatest(userId: string, confirm: string): Promise<{ restoredFrom: string; backupTime: string }> {
    if (confirm !== CONFIRM_PHRASE) {
      throw new BadRequestException(`Cần gõ đúng "${CONFIRM_PHRASE}" để xác nhận.`);
    }
    const latest = await this.getLatest();
    if (!latest) {
      throw new NotFoundException('Không có bản backup nào để khôi phục.');
    }
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new InternalServerErrorException('Thiếu DATABASE_URL.');
    }
    // psql (libpq) không hiểu tham số `schema` của Prisma → bỏ đi, giữ các tham số khác.
    let psqlUrl = dbUrl;
    try {
      const u = new URL(dbUrl);
      u.searchParams.delete('schema');
      psqlUrl = u.toString();
    } catch {
      /* URL không chuẩn → dùng nguyên bản */
    }
    const filePath = path.join(this.dir, latest.fileName);
    try {
      await execAsync(
        `gunzip -c ${JSON.stringify(filePath)} | psql ${JSON.stringify(psqlUrl)} -v ON_ERROR_STOP=1`,
        { maxBuffer: 64 * 1024 * 1024 },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Khôi phục thất bại: ${msg.slice(0, 500)}`);
    }
    await this.audit.log({
      userId,
      action: 'RESTORE_DATABASE',
      entityType: 'SYSTEM',
      entityId: latest.fileName,
      detail: `Khôi phục DB từ bản backup ${latest.fileName} (${latest.createdAt}).`,
    });
    return { restoredFrom: latest.fileName, backupTime: latest.createdAt };
  }
}
