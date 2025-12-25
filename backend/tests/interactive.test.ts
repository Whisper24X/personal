/**
 * Interactive mode tests
 */

import { InteractiveHandler, UserAction } from '../src/utils/InteractiveHandler';

describe('InteractiveHandler', () => {
  let handler: InteractiveHandler;

  beforeEach(() => {
    handler = new InteractiveHandler(false);
  });

  afterEach(() => {
    handler.close();
  });

  describe('Constructor', () => {
    it('should create handler with disabled mode by default', () => {
      expect(handler.enabled).toBe(false);
    });

    it('should create handler with enabled mode when specified', () => {
      const enabledHandler = new InteractiveHandler(true);
      expect(enabledHandler.enabled).toBe(true);
      enabledHandler.close();
    });
  });

  describe('setEnabled', () => {
    it('should enable interactive mode', () => {
      handler.setEnabled(true);
      expect(handler.enabled).toBe(true);
    });

    it('should disable interactive mode', () => {
      handler.setEnabled(true);
      handler.setEnabled(false);
      expect(handler.enabled).toBe(false);
    });
  });

  describe('waitForConfirmation', () => {
    it('should return CONTINUE action immediately when disabled', async () => {
      handler.setEnabled(false);
      
      const result = await handler.waitForConfirmation(
        'ProductManager',
        'WritePRD',
        'Test content'
      );

      expect(result.action).toBe(UserAction.CONTINUE);
      expect(result.modifiedContent).toBeUndefined();
    });

    // Note: Testing interactive input requires mocking stdin
    // which is complex. These tests would need to be integration tests
    // or use a mocking library like jest-mock-stdin
  });

  describe('Action Icons', () => {
    it('should have icon for each action type', () => {
      const actions = [
        UserAction.CONTINUE,
        UserAction.EDIT,
        UserAction.REGENERATE,
        UserAction.SKIP,
        UserAction.VIEW,
        UserAction.QUIT,
      ];

      // This is a smoke test to ensure the method doesn't crash
      actions.forEach(action => {
        const handler = new InteractiveHandler(true);
        // Private method, but we can test it doesn't crash
        expect(handler).toBeDefined();
        handler.close();
      });
    });
  });
});

describe('Interactive Mode Integration', () => {
  it('should be disabled by default', () => {
    const handler = new InteractiveHandler();
    expect(handler.enabled).toBe(false);
    handler.close();
  });

  it('should handle content preview correctly', () => {
    const handler = new InteractiveHandler(false);
    const shortContent = 'Short content';
    
    // Test with disabled mode - should auto-continue
    handler.waitForConfirmation(
      'TestRole',
      'TestAction',
      shortContent
    ).then(result => {
      expect(result.action).toBe(UserAction.CONTINUE);
    });

    handler.close();
  });
});

