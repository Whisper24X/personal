import { BadRequestException } from '@nestjs/common';
import {
  assertGitRefSlugSegment,
  buildProjectWorkspaceBranch,
} from './git-ref-name.util';

describe('git-ref-name.util', () => {
  describe('assertGitRefSlugSegment', () => {
    it('should return trimmed slug for valid input', () => {
      expect(assertGitRefSlugSegment('  my-app  ', '项目标识')).toBe('my-app');
    });

    it('should reject empty slug', () => {
      expect(() => assertGitRefSlugSegment('  ', '项目标识')).toThrow(
        BadRequestException,
      );
    });

    it('should reject path-like segments', () => {
      expect(() => assertGitRefSlugSegment('../x', '项目标识')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('buildProjectWorkspaceBranch', () => {
    it('should build bl/project branch name', () => {
      expect(buildProjectWorkspaceBranch('frontend', 'ainative')).toBe(
        'frontend-ainative',
      );
    });

    it('should reject invalid business line slug', () => {
      expect(() => buildProjectWorkspaceBranch('', 'app')).toThrow(
        BadRequestException,
      );
    });
  });
});
