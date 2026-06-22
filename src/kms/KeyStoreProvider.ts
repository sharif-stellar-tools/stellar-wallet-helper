/**
 * Represents a stored key entry returned by a KMS provider.
 */
export interface KeyEntry {
  /** Provider-specific key identifier (e.g. ARN, Vault path). */
  id: string;
  /** Base64-encoded ciphertext of the encrypted value. */
  ciphertext: string;
}

/**
 * Common interface for enterprise-grade key storage backends.
 * Implementations must handle authentication with the backing service.
 */
export interface KeyStoreProvider {
  /**
   * Encrypts plaintext and stores it under the given key identifier.
   *
   * @param keyId   - The provider key/alias used to encrypt.
   * @param plaintext - UTF-8 string to encrypt.
   * @returns A {@link KeyEntry} containing the identifier and ciphertext.
   */
  encrypt(keyId: string, plaintext: string): Promise<KeyEntry>;

  /**
   * Decrypts a previously stored ciphertext.
   *
   * @param entry - The {@link KeyEntry} returned by {@link encrypt}.
   * @returns The original plaintext.
   */
  decrypt(entry: KeyEntry): Promise<string>;
}
