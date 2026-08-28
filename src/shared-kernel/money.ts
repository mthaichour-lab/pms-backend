export class Money {
  private constructor(
    readonly currency: string,
    private readonly minorUnits: bigint,
    readonly scale: number,
  ) {}

  static parse(amount: string, currency: string, scale: number): Money {
    if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError('Money currency must be ISO 4217 uppercase');
    if (!Number.isInteger(scale) || scale < 0 || scale > 12) throw new RangeError('Money scale must be between 0 and 12');
    const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(amount);
    if (!match) throw new TypeError('Money amount must be a canonical decimal string');
    const fraction = match[3] ?? '';
    if (fraction.length > scale) throw new RangeError(`Money amount exceeds scale ${scale}`);
    const units = BigInt(`${match[2]}${fraction.padEnd(scale, '0')}` || '0');
    return new Money(currency, match[1] === '-' ? -units : units, scale);
  }

  static fromMinorUnits(minorUnits: bigint, currency: string, scale: number): Money {
    if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError('Money currency must be ISO 4217 uppercase');
    if (!Number.isInteger(scale) || scale < 0 || scale > 12) throw new RangeError('Money scale must be between 0 and 12');
    return new Money(currency, minorUnits, scale);
  }

  toMinorUnits(): bigint {
    return this.minorUnits;
  }

  add(other: Money): Money {
    this.assertCompatible(other);
    return new Money(this.currency, this.minorUnits + other.minorUnits, this.scale);
  }

  subtract(other: Money): Money {
    this.assertCompatible(other);
    return new Money(this.currency, this.minorUnits - other.minorUnits, this.scale);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertCompatible(other);
    return this.minorUnits < other.minorUnits ? -1 : this.minorUnits > other.minorUnits ? 1 : 0;
  }

  toDecimalString(): string {
    const negative = this.minorUnits < 0n;
    const digits = (negative ? -this.minorUnits : this.minorUnits).toString().padStart(this.scale + 1, '0');
    const value = this.scale === 0
      ? digits
      : `${digits.slice(0, -this.scale)}.${digits.slice(-this.scale)}`;
    return negative && this.minorUnits !== 0n ? `-${value}` : value;
  }

  private assertCompatible(other: Money): void {
    if (this.currency !== other.currency || this.scale !== other.scale) {
      throw new TypeError('Money operations require identical currency and scale');
    }
  }
}
