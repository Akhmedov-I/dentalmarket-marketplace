import { Injectable, UnauthorizedException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/db/prisma.service';
import { RedisService } from '@shared/redis/redis.service';
import { RegisterDto, RegisterRole } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { UserStatus, KycStatus, SellerStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiration: string;
  private readonly jwtRefreshExpiration: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET', 'change-me-in-production');
    this.jwtExpiration = this.configService.get<string>('JWT_EXPIRATION', '15m');
    this.jwtRefreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');
  }

  /**
   * Register a new user (customer or seller)
   */
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email or phone number already exists');
    }

    // Perform conditional validation for seller profiles
    if (dto.role === RegisterRole.SELLER) {
      if (!dto.legalName || !dto.taxId || !dto.registrationNumber || !dto.sellerType) {
        throw new BadRequestException('Seller profile requires legalName, taxId, registrationNumber, and sellerType');
      }
    }

    // Hash password using Argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    // Run DB changes inside a transaction
    return this.prisma.$transaction(async (tx) => {
      // Find the corresponding role in database
      const dbRole = await tx.role.findUnique({
        where: { name: dto.role },
      });

      if (!dbRole) {
        throw new InternalServerErrorException(`System role "${dto.role}" does not exist. Ensure database seed was run.`);
      }

      // Create the User record (user status is active by default to allow login)
      const user = await tx.user.create({
        data: {
          email,
          phone: dto.phone || null,
          passwordHash,
          status: UserStatus.active,
          locale: 'ru-UZ',
        },
      });

      // Map user to the selected role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: dbRole.id,
        },
      });

      // Create profile details based on role
      if (dto.role === RegisterRole.CUSTOMER) {
        await tx.customerProfile.create({
          data: {
            userId: user.id,
            defaultCurrency: 'UZS',
          },
        });
      } else if (dto.role === RegisterRole.SELLER) {
        await tx.sellerProfile.create({
          data: {
            userId: user.id,
            legalName: dto.legalName!,
            taxId: dto.taxId!,
            registrationNumber: dto.registrationNumber!,
            sellerType: dto.sellerType!,
            country: 'UZ',
            kycStatus: KycStatus.unsubmitted,
            status: SellerStatus.onboarding,
            commissionRateBps: 0, // default commission rate
          },
        });
      }

      // Return user details without password hash
      const { passwordHash: _, ...result } = user;
      return result;
    });
  }

  /**
   * Log in user, verify credentials, and generate tokens
   */
  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();

    // Find user by email and fetch their roles
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password hash
    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check status
    if (user.status === UserStatus.suspended || user.status === UserStatus.banned) {
      throw new UnauthorizedException(`Your account has been ${user.status}`);
    }

    // Map role names
    const roleNames = user.userRoles.map((ur) => ur.role.name);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate token pair
    return this.generateTokenPair(user.id, user.email, roleNames);
  }

  /**
   * Rotate access and refresh tokens
   */
  async refresh(dto: RefreshDto) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.jwtSecret,
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = payload.sub;
    const jti = payload.jti;

    if (!userId || !jti) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    // Check token blacklist/whitelist in Redis
    const redisKey = `refresh_token:${userId}:${jti}`;
    const tokenExists = await this.redis.get(redisKey);

    if (!tokenExists) {
      throw new UnauthorizedException('Refresh token is invalid or has already been used');
    }

    // Invalidate the old refresh token immediately (prevent token reuse)
    await this.redis.del(redisKey);

    // Fetch user and current roles from DB
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.status === UserStatus.suspended || user.status === UserStatus.banned) {
      throw new UnauthorizedException('User is inactive or deleted');
    }

    const roleNames = user.userRoles.map((ur) => ur.role.name);

    // Generate new token pair
    return this.generateTokenPair(user.id, user.email, roleNames);
  }

  /**
   * Log out user and revoke the refresh token session from Redis
   */
  async logout(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.jwtSecret,
      });
      const userId = payload.sub;
      const jti = payload.jti;

      if (userId && jti) {
        await this.redis.del(`refresh_token:${userId}:${jti}`);
      }
    } catch (e) {
      // Gracefully eat errors on logout, since we're just cleaning up
    }
  }

  /**
   * Generate access token and refresh token, and store session in Redis
   */
  private async generateTokenPair(userId: string, email: string, roles: string[]) {
    const accessTokenPayload: JwtPayload = {
      sub: userId,
      email,
      roles,
    };

    const jti = uuidv4();
    const refreshTokenPayload = {
      sub: userId,
      jti,
    };

    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiration as any,
    });

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtRefreshExpiration as any,
    });

    // Parse TTL string (e.g., '7d') into seconds
    const ttlSeconds = this.parseDurationToSeconds(this.jwtRefreshExpiration);

    // Store the refresh token jti session in Redis
    await this.redis.set(`refresh_token:${userId}:${jti}`, 'true', ttlSeconds);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Parses standard duration strings (e.g. '15m', '7d') to seconds
   */
  private parseDurationToSeconds(duration: string): number {
    const matches = duration.match(/^(\d+)([msdh])$/);
    if (!matches) {
      return 604800; // default to 7 days
    }
    const val = parseInt(matches[1], 10);
    const unit = matches[2];

    switch (unit) {
      case 'm': return val * 60;
      case 'h': return val * 3600;
      case 'd': return val * 86400;
      default: return val;
    }
  }
}
