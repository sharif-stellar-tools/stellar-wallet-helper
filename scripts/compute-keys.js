const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const { Keypair } = require('@stellar/stellar-sdk');

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const seed = bip39.mnemonicToSeedSync(mnemonic);
[0,1].forEach(i => {
  const { key } = derivePath(`m/44'/148'/${i}'`, seed.toString('hex'));
  console.log(i, Keypair.fromRawEd25519Seed(key).publicKey());
});
