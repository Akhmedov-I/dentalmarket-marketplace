import { Injectable, BadRequestException } from '@nestjs/common';
import { LedgerAccount, LedgerDirection, LedgerEntryType, Prisma } from '@prisma/client';

export interface LedgerEntryDto {
  paymentId: string;
  entryType: LedgerEntryType;
  account: LedgerAccount;
  amount: bigint;
  currency: string;
  relatedPartyId?: string;
  externalRef?: string;
}

@Injectable()
export class LedgerService {
  /**
   * Record a single entry in the append-only ledger under transaction context `tx`.
   */
  async recordEntry(
    tx: Prisma.TransactionClient,
    direction: LedgerDirection,
    dto: LedgerEntryDto,
  ) {
    if (dto.amount <= 0n) {
      throw new BadRequestException('Ledger entry amount must be greater than zero');
    }

    return tx.ledgerEntry.create({
      data: {
        paymentId: dto.paymentId,
        entryType: dto.entryType,
        account: dto.account,
        direction,
        amount: dto.amount,
        currency: dto.currency,
        relatedPartyId: dto.relatedPartyId || null,
        externalRef: dto.externalRef || null,
      },
    });
  }

  /**
   * Record a matching debit/credit entry under transaction context `tx`.
   * Enforces double-entry constraints: amounts and currencies must balance to zero.
   */
  async recordDoubleEntry(
    tx: Prisma.TransactionClient,
    debitDto: LedgerEntryDto,
    creditDto: LedgerEntryDto,
  ) {
    if (debitDto.amount !== creditDto.amount) {
      throw new BadRequestException(`Double-entry amounts do not match: debit=${debitDto.amount}, credit=${creditDto.amount}`);
    }
    if (debitDto.currency !== creditDto.currency) {
      throw new BadRequestException(`Double-entry currencies do not match: debit=${debitDto.currency}, credit=${creditDto.currency}`);
    }

    const debit = await this.recordEntry(tx, LedgerDirection.debit, debitDto);
    const credit = await this.recordEntry(tx, LedgerDirection.credit, creditDto);

    return { debit, credit };
  }
}
