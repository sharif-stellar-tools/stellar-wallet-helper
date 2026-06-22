import axios from "axios";
import { AwsKmsProvider } from "../src/kms/AwsKmsProvider";
import { VaultProvider } from "../src/kms/VaultProvider";
import { KeyEntry } from "../src/kms/KeyStoreProvider";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// axios.create returns a new instance — capture it so we can control responses.
const mockPost = jest.fn();
mockedAxios.create.mockReturnValue({ post: mockPost } as never);

const PLAINTEXT = "stellar-secret-key";
const PLAINTEXT_B64 = Buffer.from(PLAINTEXT).toString("base64");

// ──────────────────────────────────────────────
// AwsKmsProvider
// ──────────────────────────────────────────────
describe("AwsKmsProvider", () => {
  const provider = new AwsKmsProvider({
    region: "us-east-1",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  });

  const KEY_ID = "arn:aws:kms:us-east-1:111122223333:key/test-key";
  const CIPHERTEXT = "AQICAHi...base64blob==";

  beforeEach(() => mockPost.mockReset());

  it("encrypt: calls KMS Encrypt endpoint and returns KeyEntry", async () => {
    mockPost.mockResolvedValueOnce({ data: { CiphertextBlob: CIPHERTEXT } });

    const entry = await provider.encrypt(KEY_ID, PLAINTEXT);

    expect(mockPost).toHaveBeenCalledWith(
      "/",
      { KeyId: KEY_ID, Plaintext: PLAINTEXT_B64 },
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Amz-Target": "TrentService.Encrypt" }),
      })
    );
    expect(entry).toEqual<KeyEntry>({ id: KEY_ID, ciphertext: CIPHERTEXT });
  });

  it("decrypt: calls KMS Decrypt endpoint and returns plaintext", async () => {
    mockPost.mockResolvedValueOnce({ data: { Plaintext: PLAINTEXT_B64 } });

    const result = await provider.decrypt({ id: KEY_ID, ciphertext: CIPHERTEXT });

    expect(mockPost).toHaveBeenCalledWith(
      "/",
      { CiphertextBlob: CIPHERTEXT },
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Amz-Target": "TrentService.Decrypt" }),
      })
    );
    expect(result).toBe(PLAINTEXT);
  });

  it("encrypt/decrypt round-trip preserves plaintext", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { CiphertextBlob: CIPHERTEXT } })
      .mockResolvedValueOnce({ data: { Plaintext: PLAINTEXT_B64 } });

    const entry = await provider.encrypt(KEY_ID, PLAINTEXT);
    const recovered = await provider.decrypt(entry);
    expect(recovered).toBe(PLAINTEXT);
  });

  it("propagates errors from the KMS endpoint", async () => {
    mockPost.mockRejectedValueOnce(new Error("AccessDenied"));
    await expect(provider.encrypt(KEY_ID, PLAINTEXT)).rejects.toThrow("AccessDenied");
  });
});

// ──────────────────────────────────────────────
// VaultProvider
// ──────────────────────────────────────────────
describe("VaultProvider", () => {
  const provider = new VaultProvider({
    address: "https://vault.example.com:8200",
    token: "s.XXXXXX",
  });

  const KEY_ID = "stellar-key";
  const VAULT_CIPHERTEXT = "vault:v1:encryptedblob==";

  beforeEach(() => mockPost.mockReset());

  it("encrypt: calls Transit encrypt endpoint and returns KeyEntry", async () => {
    mockPost.mockResolvedValueOnce({
      data: { data: { ciphertext: VAULT_CIPHERTEXT } },
    });

    const entry = await provider.encrypt(KEY_ID, PLAINTEXT);

    expect(mockPost).toHaveBeenCalledWith(
      `/v1/transit/encrypt/${KEY_ID}`,
      { plaintext: PLAINTEXT_B64 }
    );
    expect(entry).toEqual<KeyEntry>({ id: KEY_ID, ciphertext: VAULT_CIPHERTEXT });
  });

  it("decrypt: calls Transit decrypt endpoint and returns plaintext", async () => {
    mockPost.mockResolvedValueOnce({
      data: { data: { plaintext: PLAINTEXT_B64 } },
    });

    const result = await provider.decrypt({ id: KEY_ID, ciphertext: VAULT_CIPHERTEXT });

    expect(mockPost).toHaveBeenCalledWith(
      `/v1/transit/decrypt/${KEY_ID}`,
      { ciphertext: VAULT_CIPHERTEXT }
    );
    expect(result).toBe(PLAINTEXT);
  });

  it("uses a custom mountPath when provided", async () => {
    const custom = new VaultProvider({
      address: "https://vault.example.com:8200",
      token: "s.XXXXXX",
      mountPath: "my-transit",
    });
    mockPost.mockResolvedValueOnce({
      data: { data: { ciphertext: VAULT_CIPHERTEXT } },
    });

    await custom.encrypt(KEY_ID, PLAINTEXT);

    expect(mockPost).toHaveBeenCalledWith(
      `/v1/my-transit/encrypt/${KEY_ID}`,
      expect.anything()
    );
  });

  it("encrypt/decrypt round-trip preserves plaintext", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { data: { ciphertext: VAULT_CIPHERTEXT } } })
      .mockResolvedValueOnce({ data: { data: { plaintext: PLAINTEXT_B64 } } });

    const entry = await provider.encrypt(KEY_ID, PLAINTEXT);
    const recovered = await provider.decrypt(entry);
    expect(recovered).toBe(PLAINTEXT);
  });

  it("propagates errors from the Vault endpoint", async () => {
    mockPost.mockRejectedValueOnce(new Error("permission denied"));
    await expect(provider.encrypt(KEY_ID, PLAINTEXT)).rejects.toThrow("permission denied");
  });
});
