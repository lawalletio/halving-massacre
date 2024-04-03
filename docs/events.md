## Published Events
### Replaceable
#### State

```json
{
  "kind": 31111,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "<last_modified>"],
    ["d", "state:<setup_id>"],
    ["L", "halving-massacre"],
    ["l", "state", "halving-massacre"],
    ["block", "current_block"]
  ],
  "content": {
    "currentBlock": block_number,
    "players": {
      "walias": power_amount,
      ...
    },
    "nextFreeze": blockNumber,
    "nextMassacre": blockNumber,
    "status": "SETUP" | "INITIAL" | "NORMAL" | "FREEZE" | "FINAL"
    "roundLength": number,
    "freezeDuration": number,
 },
 ...(id, pubkey, sig, created_at)
}
```

### Regular
#### Setup

```json
{
  "kind": 1112,
  "tags": [
    ["p", "<creator>"],
    ["L", "halving-massacre"],
    ["l", "setup", "halving-massacre"],
    ["block", "current_block"]
  ],
  "content": {
      "initialPool": millisats,
      "finalBlock": number,
      "ticketPrice": millisats,
      "minBet": millisats
  },
 ...(id, pubkey, sig, created_at)
}
```

#### Ticket

```json
  "kind": 1112,
  "tags": [
    ["p", "<buyer>"], // optional
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "zap-receipt"],
    ["L", "halving-massacre"],
    ["l", "ticket", "halving-massacre"],
    ["i", "<walias>"],
    ["block", "current_block"]
  ],
  "content": {
      "player": "walias"
  }
 ...(id, pubkey, sig, created_at)
```

#### Power receipt

```json
  "kind": 1112,
  "tags": [
    ["p", "<buyer>"], // optional
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "zap-receipt"],
    ["L", "halving-massacre"],
    ["l", "power-receipt", "halving-massacre"],
    ["i", "walias"],
    ["amount", "millisats"],
    ["block", "current_block"]
  ],
  "content": {
      "amount": millisats,
      "player": "walias"
  }
 ...(id, pubkey, sig, created_at)
```

#### Start

```json
  "kind": 1112,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["L", "halving-massacre"],
    ["l", "start", "halving-massacre"],
    ["block", "current_block"]
  ],
  "content": JSON.stringify({
      "initialBlock": number,
      "lockDuration": number,
      "roundLength": number,
  }),
 ...(id, pubkey, sig, created_at)
```

#### Freeze

```json
  kind: 1112,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "zap-receipt"],
    ["L", "halving-massacre"],
    ["l", "freeze", "halving-massacre"],
    ["block", "current_block"]
  ],
  "content": {
    "currentBlock": block_number,
    "players": {
      "walias": power_amount,
      ...
    }
  }
 ...(id, pubkey, sig, created_at)
```

#### Change round length

```json
  "kind": 1112,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["L", "halving-massacre"],
    ["l", "change-round-length", "halving-massacre"],
    ["block", "current_block"]
  ],
  "content": {
      "roundLength": number,
      "freezeTimeout": number,
  },
 ...(id, pubkey, sig, created_at)
```

#### Massacre

```json
  "kind": 1112,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["L", "halving-massacre"],
    ["l", "massacre", "halving-massacre"],
    ["block", "current_block"],
    ["hash", "block_hash"]
  ],
  "content": {
    "block": {
      "id": "block-id",
      "header": "block-header",
      "height": number,
      "merkleRoot": "merkle-root",
    }
    "players": {
      "walias": power_amount,
      ...
    },
    "deadPlayers": ["<walias>", "<walias>" ...]
  }
 ...(id, pubkey, sig, created_at)
```

#### Final

```json
  "kind": 1112,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "massacre"],
    ["L", "halving-massacre"],
    ["l", "final", "halving-massacre"],
    ["block", "current_block"],
    ["hash", "block_hash"]
  ],
  "content": {
    "block": {
      "id": "block-id",
      "header": "block-header",
      "height": number,
      "merkleRoot": "merkle-root",
    }
    "survivor": "walias",
    "totalPool": millisats
  }
 ...(id, pubkey, sig, created_at)
```
