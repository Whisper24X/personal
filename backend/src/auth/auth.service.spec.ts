import { AuthService } from './auth.service';

describe('AuthService', () => {
  const createService = (adminUsernames: string[]) => {
    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'auth.adminUsernames') {
          return adminUsernames;
        }

        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'auth.expires': '15m',
          'auth.secret': 'jwt-secret',
          'auth.refreshSecret': 'refresh-secret',
          'auth.refreshExpires': '3650d',
        };

        return values[key];
      }),
    };

    const service = new AuthService(
      jwtService as never,
      {} as never,
      {} as never,
      configService as never,
    );

    return { configService, jwtService, service };
  };

  it('should issue admin role tokens for configured admin usernames', async () => {
    const { jwtService, service } = createService(['admin']);

    await (
      service as unknown as { getTokensData: AuthService['getTokensData'] }
    ).getTokensData({
      id: 'user-1',
      username: 'admin',
    });

    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      {
        sub: 'user-1',
        username: 'admin',
        roles: ['admin'],
      },
      {
        secret: 'jwt-secret',
        expiresIn: '15m',
      },
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      {
        sub: 'user-1',
        username: 'admin',
        roles: ['admin'],
      },
      {
        secret: 'refresh-secret',
        expiresIn: '3650d',
      },
    );
  });

  it('should keep regular users on the user role', async () => {
    const { jwtService, service } = createService(['admin']);

    await (
      service as unknown as { getTokensData: AuthService['getTokensData'] }
    ).getTokensData({
      id: 'user-2',
      username: 'alice',
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-2',
        username: 'alice',
        roles: ['user'],
      }),
      expect.any(Object),
    );
  });
});
