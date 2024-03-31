#### State
```json
{
  "kind": 31111,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "<lastmodifier>"],
    ["d", "state"],
    ["L", "halving-massacre"],
    ["l", "state", "halving-massacre"],
    ["block", "current_block"]
  ],
  "content": {
    "currentBlock": block_number,
    "players": {
      "lud16": "amount",
      ...
    },
    "nextFreeze": blockNumber,
    "nextHalving": blockNumber,
    "status": "SETUP" | "INITIAL" | "NORMAL" | "FREEZE" | "FINAL"
    "currentFreezeLock": number,
    "currentBlockLength": number,
 },
 ...(id, pubkey, sig, created_at)
}
```

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
      "initialPool": "millisats",
      "finalBlock": number,
      "ticketPrice": number,
      "minBet": "millisats"
  },
 ...(id, pubkey, sig, created_at)
}
```

#### Ticket
```json
  "kind": 1112,
  "tags": [
    ["p", "<comprador>"], //optional
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "zap-receipt"],
    ["L", "halving-massacre"],
    ["l", "ticket", "halving-massacre"],
    ["i", "lud-16"],
    ["block", "current_block"]
  ],
  "content": {
      "player": "lud-16"
  }
 ...(id, pubkey, sig, created_at)
```

#### Bet Receipt
```json
  "kind": 1112,
  "tags": [
    ["p", "<comprador>"], //opcional
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "zap-receipt"],
    ["L", "halving-massacre"],
    ["l", "bet-receipt", "halving-massacre"],
    ["i", "lud-16"],
    ["amount", "millisats"],
    ["block", "current_block"]
  ],
  "content": {
      "amount": "millisats",
      "player": "lud-16"
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
      "lud16": "amount",
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
      "lud16": "amount",
      ...
    }
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
    "survivor": "lud16",
    "totalPool": "millisats"
  }
 ...(id, pubkey, sig, created_at)
```

