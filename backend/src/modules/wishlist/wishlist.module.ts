import { Module } from '@nestjs/common';
import { WishlistService } from './services/wishlist.service';
import { WishlistController } from './controllers/wishlist.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [WishlistController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
