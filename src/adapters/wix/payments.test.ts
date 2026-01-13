/**
 * Wix Payments Client Tests
 * 
 * Unit tests for the Wix Payments API client.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WixPaymentsClient, createMockWixPaymentsClient } from './payments.js';

describe('WixPaymentsClient', () => {
  let client: WixPaymentsClient;

  beforeEach(() => {
    // Create client in mock mode for testing
    client = createMockWixPaymentsClient();
  });

  describe('Mock Mode', () => {
    it('should be in mock mode when forced', () => {
      const mockClient = createMockWixPaymentsClient();
      expect(mockClient.isMockMode()).toBe(true);
    });

    it('should be in mock mode when created with null client', () => {
      const mockClient = new WixPaymentsClient(null, true);
      expect(mockClient.isMockMode()).toBe(true);
    });
  });

  describe('Card Tokenization (Mock)', () => {
    it('should create card token in mock mode', async () => {
      const result = await client.createCardToken({
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2028',
        cvv: '123',
      });

      expect(result.cardToken).toBeDefined();
      expect(result.cardToken).toMatch(/^wix_tok_mock_/);
      expect(result.cardBrand).toBe('VISA');
      expect(result.lastFourDigits).toBe('1111');
      expect(result.expiryMonth).toBe('12');
      expect(result.expiryYear).toBe('2028');
      expect(result.expiresAt).toBeDefined();
    });

    it('should detect Mastercard', async () => {
      const result = await client.createCardToken({
        cardNumber: '5111111111111111',
        expiryMonth: '12',
        expiryYear: '2028',
        cvv: '123',
      });

      expect(result.cardBrand).toBe('MASTERCARD');
    });

    it('should detect AMEX', async () => {
      const result = await client.createCardToken({
        cardNumber: '371111111111111',
        expiryMonth: '12',
        expiryYear: '2028',
        cvv: '1234',
      });

      expect(result.cardBrand).toBe('AMEX');
    });

    it('should detect Discover', async () => {
      const result = await client.createCardToken({
        cardNumber: '6011111111111111',
        expiryMonth: '12',
        expiryYear: '2028',
        cvv: '123',
      });

      expect(result.cardBrand).toBe('DISCOVER');
    });

    it('should return UNKNOWN for unrecognized card', async () => {
      const result = await client.createCardToken({
        cardNumber: '9999999999999999',
        expiryMonth: '12',
        expiryYear: '2028',
        cvv: '123',
      });

      expect(result.cardBrand).toBe('UNKNOWN');
    });
  });

  describe('Transaction Management (Mock)', () => {
    it('should create transaction with capture', async () => {
      const result = await client.createTransaction({
        amount: 1000,
        currency: 'USD',
        cardToken: 'wix_tok_mock_123',
        captureNow: true,
      });

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^txn_mock_/);
      expect(result.status).toBe('CAPTURED');
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe('USD');
      expect(result.authorizationCode).toBeDefined();
    });

    it('should create transaction without capture (authorize only)', async () => {
      const result = await client.createTransaction({
        amount: 2500,
        currency: 'EUR',
        cardToken: 'wix_tok_mock_456',
        captureNow: false,
      });

      expect(result.status).toBe('APPROVED');
    });

    it('should get transaction', async () => {
      const result = await client.getTransaction('txn_123');

      expect(result.id).toBe('txn_123');
      expect(result.status).toBe('CAPTURED');
    });

    it('should capture transaction', async () => {
      const result = await client.captureTransaction('txn_123');

      expect(result.id).toBe('txn_123');
      expect(result.status).toBe('CAPTURED');
    });

    it('should void transaction', async () => {
      const result = await client.voidTransaction('txn_123');

      expect(result.id).toBe('txn_123');
      expect(result.status).toBe('VOIDED');
    });
  });

  describe('Refunds (Mock)', () => {
    it('should process refund', async () => {
      const result = await client.refundTransaction('txn_123', {
        amount: 500,
        reason: 'Customer request',
      });

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^ref_mock_/);
      expect(result.transactionId).toBe('txn_123');
      expect(result.status).toBe('COMPLETED');
      expect(result.amount).toBe(500);
    });
  });
});
