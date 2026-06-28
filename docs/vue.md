# Vue Integration Guide

Integrating `stellar-wallet-helper` into a Vue 3 application is straightforward. This guide covers how to set up the library and manage the wallet state reactively.

## Installation

Inside your Vue project directory, install the package and its peer dependencies:

```bash
npm install stellar-wallet-helper @stellar/stellar-sdk
# OR
yarn add stellar-wallet-helper @stellar/stellar-sdk
```

## Basic Usage with Vue 3 (Composition API)

Vue's Composition API provides a powerful way to manage wallet state and reactively update the UI when the wallet connects or disconnects.

### Example: Wallet Connect Component

Here is a simple example component `WalletConnect.vue` demonstrating how to initialize and use `stellar-wallet-helper`.

```vue
<template>
  <div class="wallet-container">
    <h2>Stellar Wallet</h2>
    
    <div v-if="wallet">
      <p><strong>Connected Public Key:</strong></p>
      <p class="pub-key">{{ wallet.publicKey }}</p>
      
      <button @click="disconnect">Disconnect Wallet</button>
    </div>
    
    <div v-else>
      <button @click="connect" :disabled="loading">
        {{ loading ? 'Generating...' : 'Generate New Wallet' }}
      </button>
    </div>
    
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
// Assuming stellar-wallet-helper provides these exports
import { generateWallet } from 'stellar-wallet-helper'

const wallet = ref(null)
const loading = ref(false)
const error = ref('')

const connect = async () => {
  loading.value = true
  error.value = ''
  try {
    const newWallet = await generateWallet()
    wallet.value = newWallet
  } catch (err) {
    error.value = 'Failed to generate wallet: ' + err.message
  } finally {
    loading.value = false
  }
}

const disconnect = () => {
  wallet.value = null
}
</script>

<style scoped>
.wallet-container {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  max-width: 400px;
  margin: 0 auto;
}
.pub-key {
  word-break: break-all;
  font-family: monospace;
  background: #f4f4f4;
  padding: 10px;
  border-radius: 4px;
}
.error {
  color: red;
  margin-top: 10px;
}
</style>
```

## Vite Configuration (If using Vite)

If your Vue project was bootstrapped with Vite, you may need to polyfill Node.js core modules like `buffer` for the underlying Stellar SDK to function properly.

Install the required polyfill plugin:

```bash
npm install --save-dev vite-plugin-node-polyfills
```

Update your `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    vue(),
    nodePolyfills({
      include: ['buffer'],
      globals: {
        Buffer: true,
      },
    }),
  ],
})
```

## Common Use Cases

- **State Management**: Consider storing the instantiated `wallet` instance in Pinia or Vuex to make it accessible across different components.
- **Handling Asynchronous Methods**: `stellar-wallet-helper` methods for signing or submitting transactions are asynchronous. Always use `async/await` and handle errors properly in your Vue components.
