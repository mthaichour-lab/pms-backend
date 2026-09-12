import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspace = process.cwd();

describe('DDD and hexagonal boundaries', () => {
  it('keeps domain code pure and independent from frameworks and I/O', async () => {
    const files = (await sourceFiles(join(workspace, 'src', 'modules')))
      .filter((file) => file.includes(`${join('', 'domain', '')}`));
    const violations = await forbiddenImports(files, [
      /from ['"]@nestjs\//, /from ['"]pg['"]/, /from ['"]amqplib['"]/,
      /from ['"]node:(?:fs|net|http|https|stream)/, /\/infrastructure\//,
      /@prisma\/client|PrismaClient/,
    ]);
    expect(violations).toEqual([]);
  });

  it('keeps application use cases independent from adapters', async () => {
    const files = (await sourceFiles(join(workspace, 'src', 'modules')))
      .filter((file) => file.includes(`${join('', 'application', '')}`));
    const violations = await forbiddenImports(files, [
      /\/infrastructure\//, /from ['"]@nestjs\//, /from ['"]pg['"]/,
      /@prisma\/client|PrismaClient/,
    ]);
    expect(violations).toEqual([]);
  });

  it('prevents Active Record or direct database access in API controllers', async () => {
    const files = (await sourceFiles(join(workspace, 'apps', 'api', 'src')))
      .filter((file) => file.endsWith('.controller.ts'));
    const violations = await forbiddenImports(files, [
      /from ['"]pg['"]/, /@prisma\/client|PrismaClient/,
      /infrastructure\/persistence/, /\.\$queryRaw\b|\.\$executeRaw\b/,
    ]);
    const packageJson = await readFile(join(workspace, 'package.json'), 'utf8');
    if (/@prisma\/client|"prisma"/.test(packageJson)) violations.push('package.json: Prisma dependency');
    expect(violations).toEqual([]);
  });

  it('keeps Algerian regulatory rules outside the financial engine', async () => {
    const files = await sourceFiles(join(workspace, 'src', 'modules', 'profit-calculation'));
    const violations = await forbiddenImports(files, [
      /BANK_OF_ALGERIA|Banque d['’]Algérie|REG(?:LEMENT)?[_ .-]?20[_ .-]?02|\bIRG\b/i,
    ]);
    expect(violations).toEqual([]);
  });
});

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  }));
  return nested.flat();
}

async function forbiddenImports(files: readonly string[], patterns: readonly RegExp[]): Promise<string[]> {
  const violations: string[] = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(source)) violations.push(`${file}: ${pattern.source}`);
    }
  }
  return violations;
}
