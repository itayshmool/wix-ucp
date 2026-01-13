/**
 * Member Mapper
 * 
 * Maps Wix Member data to UCP format.
 * See: .cursor/rules/modules/identity.mdc
 */

import { logger } from '../../lib/logger.js';
import type { Address } from '../../core/types/ucp-common.js';
import type {
  UserInfo,
  UCPMemberProfile,
  LoyaltyInfo,
  SavedPaymentMethod,
} from './types.js';
import { OAUTH_SCOPES } from './types.js';

// ─────────────────────────────────────────────────────────────
// Wix Member Types (simplified)
// ─────────────────────────────────────────────────────────────

interface WixMember {
  id: string;
  loginEmail?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    profilePhoto?: { url: string };
  };
  contact?: {
    emails?: Array<{ email: string; primary?: boolean }>;
    phones?: Array<{ phone: string; primary?: boolean }>;
    addresses?: Array<{
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      subdivision?: string;
      country?: string;
      postalCode?: string;
    }>;
  };
  privacyStatus?: string;
  createdDate?: string;
}

// ─────────────────────────────────────────────────────────────
// Mapping Functions
// ─────────────────────────────────────────────────────────────

/**
 * Map Wix Member to UCP UserInfo response
 */
export function mapMemberToUserInfo(
  member: WixMember,
  scope: string[]
): UserInfo {
  const userInfo: UserInfo = {
    sub: member.id,
    ucp_member_id: member.id,
  };

  // Profile scope - basic name info
  if (scope.includes(OAUTH_SCOPES.PROFILE)) {
    const firstName = member.profile?.firstName;
    const lastName = member.profile?.lastName;

    if (firstName || lastName) {
      userInfo.name = [firstName, lastName].filter(Boolean).join(' ');
      userInfo.given_name = firstName;
      userInfo.family_name = lastName;
    }

    if (member.profile?.profilePhoto?.url) {
      userInfo.picture = member.profile.profilePhoto.url;
    }
  }

  // Email scope
  if (scope.includes(OAUTH_SCOPES.EMAIL)) {
    const primaryEmail = member.contact?.emails?.find((e) => e.primary)?.email 
      ?? member.loginEmail;
    
    if (primaryEmail) {
      userInfo.email = primaryEmail;
      userInfo.email_verified = true; // Wix verifies emails
    }
  }

  // Addresses scope
  if (scope.includes(OAUTH_SCOPES.ADDRESSES_READ)) {
    userInfo.ucp_saved_addresses = mapWixAddresses(member.contact?.addresses);
  }

  return userInfo;
}

/**
 * Map Wix Member to full UCP Member Profile
 */
export function mapMemberToProfile(
  member: WixMember,
  scope: string[],
  loyaltyInfo?: LoyaltyInfo,
  savedPaymentMethods?: SavedPaymentMethod[]
): UCPMemberProfile {
  const email = member.contact?.emails?.find((e) => e.primary)?.email 
    ?? member.loginEmail 
    ?? '';

  const profile: UCPMemberProfile = {
    id: member.id,
    email,
    addresses: [],
  };

  // Name
  if (member.profile?.firstName || member.profile?.lastName) {
    profile.name = {
      first: member.profile?.firstName ?? '',
      last: member.profile?.lastName ?? '',
    };
  }

  // Phone
  if (scope.includes(OAUTH_SCOPES.PROFILE)) {
    const primaryPhone = member.contact?.phones?.find((p) => p.primary)?.phone;
    if (primaryPhone) {
      profile.phone = primaryPhone;
    }
  }

  // Addresses
  if (scope.includes(OAUTH_SCOPES.ADDRESSES_READ)) {
    profile.addresses = mapWixAddresses(member.contact?.addresses);
  }

  // Loyalty
  if (scope.includes(OAUTH_SCOPES.LOYALTY_READ) && loyaltyInfo) {
    profile.loyaltyInfo = loyaltyInfo;
  }

  // Saved payment methods
  if (scope.includes(OAUTH_SCOPES.PAYMENT_METHODS_READ) && savedPaymentMethods) {
    profile.savedPaymentMethods = savedPaymentMethods;
  }

  return profile;
}

/**
 * Map Wix addresses to UCP format
 */
function mapWixAddresses(
  wixAddresses?: Array<{
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    subdivision?: string;
    country?: string;
    postalCode?: string;
  }>
): Address[] {
  if (!wixAddresses) {
    return [];
  }

  return wixAddresses
    .filter((addr) => addr.addressLine1 && addr.city && addr.country)
    .map((addr) => ({
      line1: addr.addressLine1!,
      line2: addr.addressLine2,
      city: addr.city!,
      state: addr.subdivision,
      postalCode: addr.postalCode ?? '',
      country: addr.country!,
    }));
}

/**
 * Add loyalty info to UserInfo
 */
export function addLoyaltyToUserInfo(
  userInfo: UserInfo,
  loyaltyInfo: LoyaltyInfo | null
): UserInfo {
  if (!loyaltyInfo) {
    return userInfo;
  }

  return {
    ...userInfo,
    ucp_loyalty_tier: loyaltyInfo.tier,
    ucp_loyalty_points: loyaltyInfo.points,
  };
}

// ─────────────────────────────────────────────────────────────
// Mock Data for Development
// ─────────────────────────────────────────────────────────────

/**
 * Get mock member data for testing
 */
export function getMockMember(memberId: string): WixMember {
  return {
    id: memberId,
    loginEmail: 'member@example.com',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      profilePhoto: { url: 'https://example.com/photo.jpg' },
    },
    contact: {
      emails: [{ email: 'member@example.com', primary: true }],
      phones: [{ phone: '+1234567890', primary: true }],
      addresses: [
        {
          addressLine1: '123 Main Street',
          city: 'New York',
          subdivision: 'NY',
          country: 'US',
          postalCode: '10001',
        },
      ],
    },
    privacyStatus: 'PUBLIC',
    createdDate: '2024-01-01T00:00:00Z',
  };
}

/**
 * Get mock loyalty info
 */
export function getMockLoyaltyInfo(memberId: string): LoyaltyInfo {
  return {
    programId: 'loyalty_program_1',
    tier: 'gold',
    points: 1500,
    lifetimePoints: 5000,
  };
}

/**
 * Get mock saved payment methods
 */
export function getMockSavedPaymentMethods(): SavedPaymentMethod[] {
  return [
    {
      id: 'pm_1',
      type: 'card',
      brand: 'VISA',
      lastDigits: '4242',
      expiryMonth: '12',
      expiryYear: '2027',
      isDefault: true,
    },
    {
      id: 'pm_2',
      type: 'card',
      brand: 'MASTERCARD',
      lastDigits: '5555',
      expiryMonth: '06',
      expiryYear: '2026',
      isDefault: false,
    },
  ];
}

/**
 * Get member data (mock or real)
 */
export async function getMemberData(
  memberId: string,
  scope: string[]
): Promise<{
  member: WixMember;
  loyaltyInfo?: LoyaltyInfo;
  savedPaymentMethods?: SavedPaymentMethod[];
}> {
  // TODO: Integrate with Wix Members API
  // For now, return mock data
  
  const member = getMockMember(memberId);
  
  let loyaltyInfo: LoyaltyInfo | undefined;
  if (scope.includes(OAUTH_SCOPES.LOYALTY_READ)) {
    loyaltyInfo = getMockLoyaltyInfo(memberId);
  }

  let savedPaymentMethods: SavedPaymentMethod[] | undefined;
  if (scope.includes(OAUTH_SCOPES.PAYMENT_METHODS_READ)) {
    savedPaymentMethods = getMockSavedPaymentMethods();
  }

  return { member, loyaltyInfo, savedPaymentMethods };
}
