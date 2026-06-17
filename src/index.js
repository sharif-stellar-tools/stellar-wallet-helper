const { StrKey } = require('@stellar/stellar-sdk');

function isValidString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isValidPublicKey(key) {
  if (!isValidString(key)) {
    return false;
  }

  try {
    return StrKey.isValidEd25519PublicKey(key);
  } catch {
    return false;
  }
}

function isValidSecretKey(key) {
  if (!isValidString(key)) {
    return false;
  }

  try {
    return StrKey.isValidEd25519SecretSeed(key);
  } catch {
    return false;
  }
}

module.exports = {
  isValidPublicKey,
  isValidSecretKey,
};
