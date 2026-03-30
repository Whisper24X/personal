import {
  assertSafeZipEntry,
  docTypeForUnpackedFile,
  shouldSkipUnpackedRelativePath,
  type ZipEntryLike,
} from './goal-unpack-input';
import { GoalSourceDocType } from './dto/goal-source-doc-type.enum';

function entry(fileName: string): ZipEntryLike {
  return { fileName };
}

describe('assertSafeZipEntry', () => {
  const target = '/tmp/goal-unpack-test';

  it('should throw on path traversal in name', () => {
    expect(() => assertSafeZipEntry(target, entry('../etc/passwd'))).toThrow();
  });

  it('should allow normal nested path', () => {
    expect(() =>
      assertSafeZipEntry(target, entry('prototype/index.html')),
    ).not.toThrow();
  });
});

describe('docTypeForUnpackedFile', () => {
  it('should classify prototype extensions', () => {
    expect(docTypeForUnpackedFile('a/index.html')).toBe(
      GoalSourceDocType.prototype,
    );
    expect(docTypeForUnpackedFile('x/page.tsx')).toBe(
      GoalSourceDocType.prototype,
    );
  });

  it('should default to requirement', () => {
    expect(docTypeForUnpackedFile('notes.md')).toBe(
      GoalSourceDocType.requirement,
    );
  });
});

describe('shouldSkipUnpackedRelativePath', () => {
  it('should skip __MACOSX', () => {
    expect(shouldSkipUnpackedRelativePath('__MACOSX/foo.txt')).toBe(true);
    expect(shouldSkipUnpackedRelativePath('x/__MACOSX/y')).toBe(true);
  });

  it('should keep normal paths', () => {
    expect(shouldSkipUnpackedRelativePath('prototype/a.html')).toBe(false);
  });
});
