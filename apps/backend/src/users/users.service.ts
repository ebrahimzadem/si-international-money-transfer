import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName?: string;
  phoneNumber?: string;
  kycStatus: string;
  kycLevel: number;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  passwordHash: string;
  fullName?: string;
  phoneNumber?: string;
  kycStatus: string;
  kycLevel: number;
}

/**
 * Users Service
 * Handles user database operations
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private pool: Pool;

  constructor(private configService: ConfigService) {
    // Initialize PostgreSQL connection pool
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.logger.log('PostgreSQL connection pool initialized');
  }

  /**
   * Create new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const query = `
      INSERT INTO users (email, password_hash, full_name, kyc_status, kyc_level)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, full_name as "fullName", password_hash as "passwordHash",
                phone as "phoneNumber", kyc_status as "kycStatus", kyc_level as "kycLevel",
                mfa_enabled as "twoFactorEnabled", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const values = [
      createUserDto.email,
      createUserDto.passwordHash,
      createUserDto.fullName || null,
      createUserDto.kycStatus,
      createUserDto.kycLevel,
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, full_name as "fullName", password_hash as "passwordHash",
             phone as "phoneNumber", kyc_status as "kycStatus", kyc_level as "kycLevel",
             mfa_enabled as "twoFactorEnabled", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE email = $1
    `;

    try {
      const result = await this.pool.query(query, [email]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Failed to find user by email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, full_name as "fullName", password_hash as "passwordHash",
             phone as "phoneNumber", kyc_status as "kycStatus", kyc_level as "kycLevel",
             mfa_enabled as "twoFactorEnabled", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE id = $1
    `;

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Failed to find user by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user
   */
  async update(id: string, updates: Partial<User>): Promise<User> {
    const allowedFields = ['fullName', 'phoneNumber', 'kycStatus', 'kycLevel', 'twoFactorEnabled'];
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        // Convert camelCase to snake_case for database
        const dbField = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, email, full_name as "fullName", password_hash as "passwordHash",
                phone as "phoneNumber", kyc_status as "kycStatus", kyc_level as "kycLevel",
                mfa_enabled as "twoFactorEnabled", created_at as "createdAt", updated_at as "updatedAt"
    `;

    values.push(id);

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to update user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM users WHERE id = $1';

    try {
      await this.pool.query(query, [id]);
    } catch (error) {
      this.logger.error(`Failed to delete user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close database connection (cleanup)
   */
  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('PostgreSQL connection pool closed');
  }
}
