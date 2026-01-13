/**
 * Identity Linking Module
 * 
 * Implements UCP Identity Linking via OAuth 2.0.
 * Enables member accounts, loyalty, saved payment methods.
 * 
 * See: .cursor/rules/modules/identity.mdc
 */

// Types
export * from './types.js';

// Token Manager
export {
  TokenManager,
  createTokenManager,
  getTokenManager,
} from './token-manager.js';

// OAuth Service
export {
  OAuthService,
  OAuthError,
  createOAuthService,
  getOAuthService,
} from './oauth-service.js';

// Member Mapper
export {
  mapMemberToUserInfo,
  mapMemberToProfile,
  addLoyaltyToUserInfo,
  getMemberData,
  getMockMember,
  getMockLoyaltyInfo,
  getMockSavedPaymentMethods,
} from './member-mapper.js';

// Routes
export { identityRoutes } from './routes.js';
