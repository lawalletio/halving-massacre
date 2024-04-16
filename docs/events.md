# Published Events

## Replaceable

### State

```json
{
  "kind": 31111,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "state"],
    ["e", "<id>", "wss://relay.lawallet.ar", "<last_modified>"],
    ["d", "state:<setup_id>"],
    ["L", "halving-massacre"],
    ["l", "state", "halving-massacre"],
    ["block", "<current_block_number>"]
  ],
  "content": JSON.stringify({
    "currentBlock": <current_block_number>,
    "currentPool": <total_prize>,
    "players": {
      "<walias>": <power_for_walias>,
      ...
    },
    "nextFreeze": <next_freeze_block_number>,
    "nextMassacre": <next_massacre_block_number>,
    "status": "<SETUP | CLOSED | INITIAL | NORMAL | FREEZE | FINAL>",
    "playerCount": <number_of_players>,
    "buckets": [
      {
        "max": <max_power_of_bucket>,
        "min": <min_power_of_bucket>
      },
      ...
    ]
  }),
  ...
}
```

### Profile

```json
{
  "kind": 31111,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "profile"],
    ["e", "<id>", "wss://relay.lawallet.ar", "<last_modified>"],
    ["d", "profile:<setup_id>:<walias>"],
    ["L", "halving-massacre"],
    ["l", "profile", "halving-massacre"],
    ["block", "<current_block_number>"]
  ],
  "content": JSON.stringify({
    "walias": "<walias>",
    "power": <power_for_walias>,
    "deathRound": <number | null>,
    "rounds": [
      {
        "number": <round_number>,
        "maxZap": <amount_of_highest_zap>,
        "zapped": <amount_zapped>,
        "zapCount": <number_of_zaps>
      },
      ...
    ]
  }),
  ...
}
```

## Regular

### Setup

```json
{
  "kind": 1112,
  "tags": [
    ["p", "<creator>"],
    ["L", "halving-massacre"],
    ["l", "setup", "halving-massacre"],
    ["block", "<current_block>"]
  ],
  "content": JSON.stringify({
    "initialPool": <amount_of_millisats>,
    "finalBlock": <final_block_number>,
    "ticketPrice": <amount_of_millisats>,
    "minBet": <amount_of_millisats>
  }),
  ...
}
```

### Ticket

```json
{
  "kind": 1112,
  "tags": [
    ["p", "<buyer>"], // optional
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "zap-receipt"],
    ["L", "halving-massacre"],
    ["l", "ticket", "halving-massacre"],
    ["i", "<walias>"],
    ["block", "<current_block>"]
  ],
  "content": JSON.stringify({
    "player": "<walias>"
  }),
  ...
}
```

### Power receipt

```json
{
  "kind": 1112,
  "tags": [
    ["p", "<buyer>"], // optional
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "zap-receipt"],
    ["L", "halving-massacre"],
    ["l", "power-receipt", "halving-massacre"],
    ["i", "<walias>"],
    ["amount", "<amount_of_millisats>"],
    ["block", "<current_block>"]
  ],
  "content": JSON.stringify({
    "amount": <amount_of_millisats>,
    "player": "<walias>",
    "message": "<message>"
  }),
  ...
}
```

### Start

```json
{
  "kind": 1112,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["L", "halving-massacre"],
    ["l", "start", "halving-massacre"],
    ["block", "<current_block>"]
  ],
  "content": JSON.stringify({
    "massacreSchedule": [
      {
        "height": <massacre_block_height>,
        "survivors": <number_of_survivors>,
        "freezeHeight": <freeze_block_height>,
        "nextMassacre": <index | null>,
      },
      ...
    ]
  }),
  ...
}
```

### Freeze

```json
{
  kind: 1112,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "zap-receipt"],
    ["L", "halving-massacre"],
    ["l", "freeze", "halving-massacre"],
    ["block", "<current_block>"]
  ],
  "content": JSON.stringify({
    "currentBlock": <block_number>,
    "players": {
      "<walias>": <power_for_walias>,
      ...
    }
  }),
  ...
}
```

### Massacre

```json
{
  "kind": 1112,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["L", "halving-massacre"],
    ["l", "massacre", "halving-massacre"],
    ["block", "<current_block>"],
    ["hash", "<massacre_block_hash>"]
  ],
  "content": JSON.stringify({
    "block": {
      "id": "<massacre_block_id>",
      "header": "<massacre_block_-_header>",
      "height": <massacre_block_height>,
      "merkleRoot": "<massacre_block_merkle_root>"
    },
    "players": {
      "<walias>": <power_for_walias>,
      ...
    },
    "deadPlayers": [
      "<dead_plyer_walias>",
      ...
    ]
  }),
  ...
}
```

### Final

```json
{
  "kind": 1112,
  "tags": [
    ["e", "<id>", "wss://relay.lawallet.ar", "setup"],
    ["e", "<id>", "wss://relay.lawallet.ar", "massacre"],
    ["L", "halving-massacre"],
    ["l", "final", "halving-massacre"],
    ["block", "<current_block>"],
    ["hash", "<final_block_hash>"]
  ],
  "content": JSON.stringify({
    "block": {
      "id": "<final_block_id>",
      "header": "<final_block_header>",
      "height": <final_block_height>,
      "merkleRoot": "<final_block_merkle_root>"
    },
    "survivor": "<survivor_walias>",
    "totalPool": <amount_of_millisats>
  }),
  ...
}
```
