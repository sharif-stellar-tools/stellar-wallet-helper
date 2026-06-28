# React Native Integration Guide

Integrating `stellar-wallet-helper` into a React Native application allows you to seamlessly add Stellar wallet capabilities to your mobile app.

## Prerequisites

Before starting, ensure your React Native environment is set up.

React Native requires some Node.js core modules to be polyfilled. You may need to use a library like `rn-nodeify` or `node-libs-react-native` to provide missing global APIs (such as `Buffer` and `crypto`), as `stellar-wallet-helper` relies on them under the hood via the Stellar SDK.

## Installation

```bash
npm install stellar-wallet-helper @stellar/stellar-sdk
# OR
yarn add stellar-wallet-helper @stellar/stellar-sdk
```

### Installing Polyfills (If Needed)

```bash
npm install node-libs-react-native react-native-randombytes react-native-get-random-values
```

At the very top of your `index.js`, import the polyfills:

```javascript
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
```

## Basic Usage

Here is a common snippet demonstrating how to initialize a wallet and sign a transaction within a React Native component.

```tsx
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
// Assuming stellar-wallet-helper provides a WalletManager or similar helper
import { generateWallet, signTransaction } from 'stellar-wallet-helper';

export default function WalletComponent() {
  const [wallet, setWallet] = useState(null);

  const handleCreateWallet = async () => {
    try {
      // Create a new wallet
      const newWallet = await generateWallet();
      setWallet(newWallet);
    } catch (error) {
      console.error("Wallet generation failed", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stellar Wallet App</Text>
      
      {wallet ? (
        <View>
          <Text>Public Key: {wallet.publicKey}</Text>
          <Button title="Sign Dummy Tx" onPress={() => {
            // Implementation for signing a tx
          }} />
        </View>
      ) : (
        <Button title="Create New Wallet" onPress={handleCreateWallet} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 }
});
```

## Common Issues

- **Crypto / Buffer missing**: Always ensure `react-native-get-random-values` and `buffer` are imported at the app entry point.
- **Hermes Engine**: Ensure Hermes is enabled in your `android/app/build.gradle` and `ios/Podfile` for optimal performance.
