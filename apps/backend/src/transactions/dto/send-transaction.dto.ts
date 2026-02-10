import { IsString, IsNotEmpty, IsIn, Matches } from 'class-validator';

export class SendTransactionDto {
  @IsString()
  @IsIn(['BTC', 'ETH', 'USDC', 'USDT'])
  token: 'BTC' | 'ETH' | 'USDC' | 'USDT';

  @IsString()
  @IsNotEmpty()
  toAddress: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, { message: 'Amount must be a valid number' })
  amount: string;
}
