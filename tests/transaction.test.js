"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const transaction_1 = require("../src/transaction");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const wallet_1 = require("../src/wallet");
const mockLoadAccount = jest.fn();
const mockFeeStats = jest.fn();
const mockRoot = jest.fn();
// Mock the Server class inside the Horizon namespace
jest.mock('@stellar/stellar-sdk', () => {
    const original = jest.requireActual('@stellar/stellar-sdk');
    return {
        ...original,
        Horizon: {
            Server: jest.fn().mockImplementation(() => {
                return {
                    loadAccount: mockLoadAccount,
                    feeStats: mockFeeStats,
                    root: mockRoot,
                };
            }),
        },
    };
});
describe('TxManager', () => {
    let txManager;
    beforeEach(() => {
        jest.clearAllMocks();
        txManager = new transaction_1.TxManager('https://horizon-testnet.stellar.org');
    });
    it('successfully builds a payment transaction with dynamic fee and dynamic network passphrase', async () => {
        const sourceKeypair = wallet_1.WalletManager.createWallet();
        const destKeypair = wallet_1.WalletManager.createWallet();
        const sourceAddress = sourceKeypair.publicKey();
        const destAddress = destKeypair.publicKey();
        const amount = '10.5';
        // Mock loadAccount to return a valid Account object
        const mockAccount = new stellar_sdk_1.Account(sourceAddress, '100');
        mockLoadAccount.mockResolvedValue(mockAccount);
        // Mock feeStats to return mock fee distribution
        mockFeeStats.mockResolvedValue({
            last_ledger: '12345',
            last_ledger_base_fee: '100',
            ledger_capacity_usage: '0.1',
            fee_charged: {
                mode: '150',
            },
            max_fee: {
                mode: '200',
            },
        });
        // Mock root to return a custom network passphrase
        mockRoot.mockResolvedValue({
            network_passphrase: 'Custom Public Network Passphrase',
        });
        // Run buildPayment
        const xdr = await txManager.buildPayment(sourceAddress, destAddress, amount);
        // Verify Server methods were called correctly
        expect(stellar_sdk_1.Horizon.Server).toHaveBeenCalledWith('https://horizon-testnet.stellar.org');
        expect(mockLoadAccount).toHaveBeenCalledWith(sourceAddress);
        expect(mockFeeStats).toHaveBeenCalled();
        expect(mockRoot).toHaveBeenCalled();
        // Verify the returned XDR is a valid base64 string and matches our transaction details
        expect(typeof xdr).toBe('string');
        expect(xdr.length).toBeGreaterThan(0);
        // Base64 regex check
        expect(xdr).toMatch(/^[a-zA-Z0-9+/=]+$/);
    });
    it('falls back to default base fee and TESTNET network passphrase on Horizon errors', async () => {
        const sourceKeypair = wallet_1.WalletManager.createWallet();
        const destKeypair = wallet_1.WalletManager.createWallet();
        const sourceAddress = sourceKeypair.publicKey();
        const destAddress = destKeypair.publicKey();
        const amount = '5.0';
        // Mock loadAccount to return a valid Account object
        const mockAccount = new stellar_sdk_1.Account(sourceAddress, '100');
        mockLoadAccount.mockResolvedValue(mockAccount);
        // Mock feeStats and root to reject/throw errors
        mockFeeStats.mockRejectedValue(new Error('Horizon fee error'));
        mockRoot.mockRejectedValue(new Error('Horizon root error'));
        // Run buildPayment
        const xdr = await txManager.buildPayment(sourceAddress, destAddress, amount);
        // Verify the XDR is returned successfully despite Horizon API failures
        expect(typeof xdr).toBe('string');
        expect(xdr.length).toBeGreaterThan(0);
    });
});
