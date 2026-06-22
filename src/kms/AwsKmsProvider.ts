import axios, { AxiosInstance } from "axios";
import { KeyEntry, KeyStoreProvider } from "./KeyStoreProvider";

export interface AwsKmsConfig {
  /** AWS region, e.g. "us-east-1". */
  region: string;
  /** AWS access key ID. */
  accessKeyId: string;
  /** AWS secret access key. */
  secretAccessKey: string;
  /** Optional session token (for temporary credentials). */
  sessionToken?: string;
}

/**
 * AWS KMS provider using the AWS REST API via axios.
 * Uses the Encrypt and Decrypt KMS endpoints.
 */
export class AwsKmsProvider implements KeyStoreProvider {
  private readonly client: AxiosInstance;
  private readonly config: AwsKmsConfig;

  constructor(config: AwsKmsConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: `https://kms.${config.region}.amazonaws.com`,
    });
  }

  async encrypt(keyId: string, plaintext: string): Promise<KeyEntry> {
    const payload = {
      KeyId: keyId,
      Plaintext: Buffer.from(plaintext).toString("base64"),
    };

    const response = await this.client.post("/", payload, {
      headers: this.buildHeaders("Encrypt", payload),
    });

    return { id: keyId, ciphertext: response.data.CiphertextBlob };
  }

  async decrypt(entry: KeyEntry): Promise<string> {
    const payload = { CiphertextBlob: entry.ciphertext };

    const response = await this.client.post("/", payload, {
      headers: this.buildHeaders("Decrypt", payload),
    });

    return Buffer.from(response.data.Plaintext, "base64").toString("utf-8");
  }

  private buildHeaders(action: string, _payload: unknown): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `TrentService.${action}`,
    };
    if (this.config.sessionToken) {
      headers["X-Amz-Security-Token"] = this.config.sessionToken;
    }
    return headers;
  }
}
