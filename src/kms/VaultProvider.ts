import axios, { AxiosInstance } from "axios";
import { KeyEntry, KeyStoreProvider } from "./KeyStoreProvider";

export interface VaultConfig {
  /** Vault server address, e.g. "https://vault.example.com:8200". */
  address: string;
  /** Vault token for authentication. */
  token: string;
  /** Transit engine mount path. Defaults to "transit". */
  mountPath?: string;
}

/**
 * HashiCorp Vault provider using the Vault Transit secrets engine.
 * Delegates encrypt/decrypt to the Transit engine REST API.
 */
export class VaultProvider implements KeyStoreProvider {
  private readonly client: AxiosInstance;
  private readonly mount: string;

  constructor(config: VaultConfig) {
    this.mount = config.mountPath ?? "transit";
    this.client = axios.create({
      baseURL: config.address,
      headers: {
        "X-Vault-Token": config.token,
        "Content-Type": "application/json",
      },
    });
  }

  async encrypt(keyId: string, plaintext: string): Promise<KeyEntry> {
    const b64 = Buffer.from(plaintext).toString("base64");
    const response = await this.client.post(
      `/v1/${this.mount}/encrypt/${keyId}`,
      { plaintext: b64 }
    );
    return { id: keyId, ciphertext: response.data.data.ciphertext };
  }

  async decrypt(entry: KeyEntry): Promise<string> {
    const response = await this.client.post(
      `/v1/${this.mount}/decrypt/${entry.id}`,
      { ciphertext: entry.ciphertext }
    );
    return Buffer.from(response.data.data.plaintext, "base64").toString("utf-8");
  }
}
