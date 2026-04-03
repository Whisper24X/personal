const MEMBER_ROLE_CAPABILITIES_KEY = '__memberRoleCapabilities';

export function defineMemberRoleCapabilities(
  target: object,
  capabilities?: string[] | null,
): void {
  const normalized = Array.isArray(capabilities)
    ? capabilities.filter((capability): capability is string => {
        return typeof capability === 'string' && capability.trim().length > 0;
      })
    : null;

  Object.defineProperty(target, MEMBER_ROLE_CAPABILITIES_KEY, {
    value: normalized,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

export function readMemberRoleCapabilities(
  source: object | null | undefined,
): string[] | null {
  if (!source) {
    return null;
  }

  const value = Reflect.get(source, MEMBER_ROLE_CAPABILITIES_KEY);
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((capability): capability is string => {
    return typeof capability === 'string' && capability.trim().length > 0;
  });
}
