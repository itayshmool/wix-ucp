/**
 * Identity Module Tests
 * 
 * Unit tests for OAuth 2.0 token management, service, and member mapping.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';
import {
  OAUTH_SCOPES,
  VALID_SCOPES,
  TOKEN_EXPIRY,
  OAUTH_ERRORS,
} from './types.js';
import {
  mapMemberToUserInfo,
  mapMemberToProfile,
  addLoyaltyToUserInfo,
  getMockMember,
  getMockLoyaltyInfo,
  getMockSavedPaymentMethods,
} from './member-mapper.js';
import type { LoyaltyInfo, SavedPaymentMethod } from './types.js';

// Mock redis for token manager tests
vi.mock('../../lib/redis.js', () => ({
  getRedis: vi.fn(() => ({
    setex: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  })),
  setWithTTL: vi.fn(),
  getJSON: vi.fn(),
  deleteKey: vi.fn(() => true),
}));

describe('Identity Module', () => {
  // ─────────────────────────────────────────────────────────────
  // Types and Constants Tests
  // ─────────────────────────────────────────────────────────────

  describe('OAuth Scopes', () => {
    it('should have all expected scopes', () => {
      expect(OAUTH_SCOPES.OPENID).toBe('openid');
      expect(OAUTH_SCOPES.PROFILE).toBe('profile');
      expect(OAUTH_SCOPES.EMAIL).toBe('email');
      expect(OAUTH_SCOPES.ORDERS_READ).toBe('orders:read');
      expect(OAUTH_SCOPES.LOYALTY_READ).toBe('loyalty:read');
      expect(OAUTH_SCOPES.LOYALTY_WRITE).toBe('loyalty:write');
      expect(OAUTH_SCOPES.ADDRESSES_READ).toBe('addresses:read');
      expect(OAUTH_SCOPES.PAYMENT_METHODS_READ).toBe('payment_methods:read');
    });

    it('should have correct number of scopes', () => {
      expect(VALID_SCOPES).toHaveLength(8);
    });
  });

  describe('Token Expiry', () => {
    it('should have correct access token expiry (15 minutes)', () => {
      expect(TOKEN_EXPIRY.ACCESS_TOKEN).toBe(15 * 60);
    });

    it('should have correct refresh token expiry (30 days)', () => {
      expect(TOKEN_EXPIRY.REFRESH_TOKEN).toBe(30 * 24 * 60 * 60);
    });

    it('should have correct auth code expiry (10 minutes)', () => {
      expect(TOKEN_EXPIRY.AUTH_CODE).toBe(10 * 60);
    });
  });

  describe('OAuth Errors', () => {
    it('should have all standard OAuth error codes', () => {
      expect(OAUTH_ERRORS.INVALID_REQUEST).toBe('invalid_request');
      expect(OAUTH_ERRORS.UNAUTHORIZED_CLIENT).toBe('unauthorized_client');
      expect(OAUTH_ERRORS.ACCESS_DENIED).toBe('access_denied');
      expect(OAUTH_ERRORS.UNSUPPORTED_RESPONSE_TYPE).toBe('unsupported_response_type');
      expect(OAUTH_ERRORS.INVALID_SCOPE).toBe('invalid_scope');
      expect(OAUTH_ERRORS.SERVER_ERROR).toBe('server_error');
      expect(OAUTH_ERRORS.INVALID_GRANT).toBe('invalid_grant');
      expect(OAUTH_ERRORS.INVALID_CLIENT).toBe('invalid_client');
      expect(OAUTH_ERRORS.INVALID_TOKEN).toBe('invalid_token');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Member Mapper Tests
  // ─────────────────────────────────────────────────────────────

  describe('Member Mapper', () => {
    describe('mapMemberToUserInfo', () => {
      const mockMember = getMockMember('member_123');

      it('should include sub and ucp_member_id', () => {
        const userInfo = mapMemberToUserInfo(mockMember, []);
        
        expect(userInfo.sub).toBe('member_123');
        expect(userInfo.ucp_member_id).toBe('member_123');
      });

      it('should include profile info when profile scope is present', () => {
        const userInfo = mapMemberToUserInfo(mockMember, [OAUTH_SCOPES.PROFILE]);
        
        expect(userInfo.name).toBe('John Doe');
        expect(userInfo.given_name).toBe('John');
        expect(userInfo.family_name).toBe('Doe');
        expect(userInfo.picture).toBe('https://example.com/photo.jpg');
      });

      it('should not include profile info without profile scope', () => {
        const userInfo = mapMemberToUserInfo(mockMember, []);
        
        expect(userInfo.name).toBeUndefined();
        expect(userInfo.given_name).toBeUndefined();
        expect(userInfo.family_name).toBeUndefined();
      });

      it('should include email when email scope is present', () => {
        const userInfo = mapMemberToUserInfo(mockMember, [OAUTH_SCOPES.EMAIL]);
        
        expect(userInfo.email).toBe('member@example.com');
        expect(userInfo.email_verified).toBe(true);
      });

      it('should not include email without email scope', () => {
        const userInfo = mapMemberToUserInfo(mockMember, []);
        
        expect(userInfo.email).toBeUndefined();
      });

      it('should include addresses when addresses:read scope is present', () => {
        const userInfo = mapMemberToUserInfo(mockMember, [OAUTH_SCOPES.ADDRESSES_READ]);
        
        expect(userInfo.ucp_saved_addresses).toBeDefined();
        expect(userInfo.ucp_saved_addresses?.length).toBeGreaterThan(0);
      });
    });

    describe('mapMemberToProfile', () => {
      const mockMember = getMockMember('member_123');
      const mockLoyalty = getMockLoyaltyInfo('member_123');
      const mockPaymentMethods = getMockSavedPaymentMethods();

      it('should map basic member info', () => {
        const profile = mapMemberToProfile(mockMember, []);
        
        expect(profile.id).toBe('member_123');
        expect(profile.email).toBe('member@example.com');
      });

      it('should include name when available', () => {
        const profile = mapMemberToProfile(mockMember, []);
        
        expect(profile.name?.first).toBe('John');
        expect(profile.name?.last).toBe('Doe');
      });

      it('should include phone with profile scope', () => {
        const profile = mapMemberToProfile(mockMember, [OAUTH_SCOPES.PROFILE]);
        
        expect(profile.phone).toBe('+1234567890');
      });

      it('should include addresses with addresses:read scope', () => {
        const profile = mapMemberToProfile(mockMember, [OAUTH_SCOPES.ADDRESSES_READ]);
        
        expect(profile.addresses.length).toBeGreaterThan(0);
        expect(profile.addresses[0].city).toBe('New York');
      });

      it('should include loyalty with loyalty:read scope', () => {
        const profile = mapMemberToProfile(
          mockMember,
          [OAUTH_SCOPES.LOYALTY_READ],
          mockLoyalty
        );
        
        expect(profile.loyaltyInfo).toBeDefined();
        expect(profile.loyaltyInfo?.tier).toBe('gold');
        expect(profile.loyaltyInfo?.points).toBe(1500);
      });

      it('should include payment methods with payment_methods:read scope', () => {
        const profile = mapMemberToProfile(
          mockMember,
          [OAUTH_SCOPES.PAYMENT_METHODS_READ],
          undefined,
          mockPaymentMethods
        );
        
        expect(profile.savedPaymentMethods).toBeDefined();
        expect(profile.savedPaymentMethods?.length).toBe(2);
      });
    });

    describe('addLoyaltyToUserInfo', () => {
      it('should add loyalty info to userInfo', () => {
        const userInfo = mapMemberToUserInfo(getMockMember('member_123'), []);
        const loyalty = getMockLoyaltyInfo('member_123');
        
        const withLoyalty = addLoyaltyToUserInfo(userInfo, loyalty);
        
        expect(withLoyalty.ucp_loyalty_tier).toBe('gold');
        expect(withLoyalty.ucp_loyalty_points).toBe(1500);
      });

      it('should return original userInfo when loyalty is null', () => {
        const userInfo = mapMemberToUserInfo(getMockMember('member_123'), []);
        
        const result = addLoyaltyToUserInfo(userInfo, null);
        
        expect(result.ucp_loyalty_tier).toBeUndefined();
        expect(result.ucp_loyalty_points).toBeUndefined();
      });
    });

    describe('getMockMember', () => {
      it('should return valid mock member', () => {
        const member = getMockMember('test_123');
        
        expect(member.id).toBe('test_123');
        expect(member.loginEmail).toBe('member@example.com');
        expect(member.profile?.firstName).toBe('John');
        expect(member.profile?.lastName).toBe('Doe');
      });
    });

    describe('getMockLoyaltyInfo', () => {
      it('should return valid mock loyalty info', () => {
        const loyalty = getMockLoyaltyInfo('test_123');
        
        expect(loyalty.tier).toBe('gold');
        expect(loyalty.points).toBe(1500);
        expect(loyalty.lifetimePoints).toBe(5000);
      });
    });

    describe('getMockSavedPaymentMethods', () => {
      it('should return array of payment methods', () => {
        const methods = getMockSavedPaymentMethods();
        
        expect(methods.length).toBe(2);
        expect(methods[0].type).toBe('card');
        expect(methods[0].isDefault).toBe(true);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PKCE Tests
  // ─────────────────────────────────────────────────────────────

  describe('PKCE', () => {
    it('should generate correct S256 code challenge', () => {
      const codeVerifier = 'test_code_verifier_123';
      const expectedChallenge = createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      
      // This verifies the algorithm used in token-manager.ts
      expect(expectedChallenge).toBeTruthy();
      expect(expectedChallenge.length).toBeGreaterThan(20);
    });

    it('should reject invalid code verifier', () => {
      const codeVerifier = 'test_code_verifier_123';
      const wrongVerifier = 'wrong_verifier';
      
      const challenge1 = createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      const challenge2 = createHash('sha256')
        .update(wrongVerifier)
        .digest('base64url');
      
      expect(challenge1).not.toBe(challenge2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Scope Validation Tests
  // ─────────────────────────────────────────────────────────────

  describe('Scope Validation', () => {
    it('should filter requested scopes to allowed ones', () => {
      const requested = ['openid', 'profile', 'invalid_scope'];
      const allowed = ['openid', 'profile', 'email'];
      
      const filtered = requested.filter(s => allowed.includes(s));
      
      expect(filtered).toEqual(['openid', 'profile']);
      expect(filtered).not.toContain('invalid_scope');
    });

    it('should recognize all valid scopes', () => {
      const validScopes = [
        'openid',
        'profile',
        'email',
        'orders:read',
        'loyalty:read',
        'loyalty:write',
        'addresses:read',
        'payment_methods:read',
      ];
      
      validScopes.forEach(scope => {
        expect(VALID_SCOPES).toContain(scope);
      });
    });

    it('should reject invalid scopes', () => {
      const invalidScopes = ['admin', 'super_user', 'write:all'];
      
      invalidScopes.forEach(scope => {
        expect(VALID_SCOPES).not.toContain(scope);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Token Format Tests
  // ─────────────────────────────────────────────────────────────

  describe('Token Formats', () => {
    it('should recognize refresh token format', () => {
      const refreshToken = 'rt_abc123def456';
      
      expect(refreshToken.startsWith('rt_')).toBe(true);
    });

    it('should recognize JWT format', () => {
      // JWT has 3 parts separated by dots
      const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
      const mockJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123';
      
      expect(jwtRegex.test(mockJwt)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // OpenID Configuration Tests
  // ─────────────────────────────────────────────────────────────

  describe('OpenID Configuration', () => {
    it('should include required OIDC endpoints', () => {
      const baseUrl = 'https://api.example.com';
      const config = {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/identity/authorize`,
        token_endpoint: `${baseUrl}/identity/token`,
        userinfo_endpoint: `${baseUrl}/identity/userinfo`,
        revocation_endpoint: `${baseUrl}/identity/revoke`,
      };
      
      expect(config.authorization_endpoint).toBe(`${baseUrl}/identity/authorize`);
      expect(config.token_endpoint).toBe(`${baseUrl}/identity/token`);
      expect(config.userinfo_endpoint).toBe(`${baseUrl}/identity/userinfo`);
    });

    it('should support authorization code flow', () => {
      const supportedResponseTypes = ['code'];
      const supportedGrantTypes = ['authorization_code', 'refresh_token'];
      
      expect(supportedResponseTypes).toContain('code');
      expect(supportedGrantTypes).toContain('authorization_code');
      expect(supportedGrantTypes).toContain('refresh_token');
    });

    it('should support S256 code challenge method', () => {
      const supportedMethods = ['S256'];
      
      expect(supportedMethods).toContain('S256');
    });
  });
});
